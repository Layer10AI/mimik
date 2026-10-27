import { logger } from '@mimik/core/logger';
import PQueue from 'p-queue';
import { browser } from '#imports';
import { extensionCaptureSink } from '@/capture/sink';
import { extractDOMContext } from '@/core/capture/dom/context';
import { extractElementMeta, type FrozenRect, freezeRect } from '@/core/capture/dom/element-meta';
import {
  eventTarget,
  findFocusableAncestor,
  hideTypedText,
  isMimikElement,
  isNavigatingClick,
  isSensitiveField,
  isTextField,
  isTooLarge,
} from '@/core/capture/dom/element-utils';
import { locateFrame, placeInTab } from '@/core/capture/dom/frame-placement';
import { isReplayedClick, replayClick, replayInit, shouldInterceptClick } from '@/core/capture/events/click-intercept';
import { keyCombo } from '@/core/capture/key-combo';
import type { CaptureSink } from '@/core/capture/sink';
import type { StepAction } from '@/core/capture/step-action';
import { DEFAULT_TARGET_COLOR } from '@/core/screenshot/types';
import { localStorage } from '@/lib/browser-api/local-storage';
import { HoverRing } from '@/lib/hover-ring';
import { InputSession } from './input-session';
import { isRecordableKey } from './is-recordable-key';

const REPEAT_CLICK_MS = 300;
const MAC = /Mac/i.test(navigator.platform);
const DRAG_MIN_PX = 30;
const INTERCEPT_DELAY_MS = 100;
const PAINT_FRAMES = 3;
const CAPTURE_BUDGET_MS = 2500;
const EMBED_TAGS = new Set(['IFRAME', 'EMBED', 'OBJECT']);
const EMBED_SELECTOR = 'iframe, embed, object';

function focusInEmbed(): boolean {
  const active = document.activeElement;
  return !!active && EMBED_TAGS.has(active.tagName);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    let remaining = PAINT_FRAMES;
    const tick = () => {
      if (--remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

let lastClickTarget: Element | null = null;
let lastClickTime = 0;

export interface CaptureHandle {
  stop: () => Promise<void>;
}

const PASSIVE_CAPTURE = { capture: true, passive: true } as const;
// Hosts that serve the ValueScout interview page (see externally_connectable in wxt.config.ts).
const interviewHosts = new Set(['valuescout.layer10.ai', 'localhost:5173']);
const ACTIVE_CAPTURE = { capture: true } as const;

class CaptureController {
  private input: InputSession;
  private queue = new PQueue({ concurrency: 1 });
  private listeners: [string, EventListener, AddEventListenerOptions][] = [];
  private dragStartX: number | null = null;
  private dragStartY: number | null = null;
  private dragStartElement: Element | null = null;
  private ring = new HoverRing(DEFAULT_TARGET_COLOR);
  private hovered: HTMLElement | null = null;
  private busy = false;
  private recordKeys = false;
  private recordTyping = true;
  private hideTyped = { setting: false, interview: false };
  // A list option picked on pointerdown; a click on it soon after is the same pick.
  private pickedOption: Element | null = null;
  private pickedAt = 0;
  // The field whose typing step is queued but not started yet, so a keystroke can't queue a second one.
  private inputStarting: HTMLElement | null = null;
  private readonly onSettingsChanged = (changes: Record<string, { newValue?: unknown }>) => {
    if (changes.recordKeys) this.recordKeys = changes.recordKeys.newValue === true;
    if (changes.recordTyping) this.recordTyping = changes.recordTyping.newValue !== false;
    if (changes.hideTypedText) this.hideTyped.setting = changes.hideTypedText.newValue === true;
    if (changes.interviewMode) this.hideTyped.interview = changes.interviewMode.newValue === true;
    if (changes.hideTypedText || changes.interviewMode)
      hideTypedText(this.hideTyped.setting || this.hideTyped.interview);
    const color = changes.targetColor?.newValue;
    if (typeof color === 'string' && color) this.ring.setColor(color);
  };

  constructor(
    private guideId: string,
    isTopFrame: boolean,
    private sink: CaptureSink,
  ) {
    this.input = new InputSession(guideId, sink);
    this.listeners = [
      ['click', this.onClick.bind(this), ACTIVE_CAPTURE],
      ['auxclick', this.onAuxClick.bind(this), ACTIVE_CAPTURE],
      ['keydown', this.onKeydown.bind(this), ACTIVE_CAPTURE],
      ['input', this.onInput.bind(this), PASSIVE_CAPTURE],
      ['focusout', this.onFocusOut.bind(this), PASSIVE_CAPTURE],
    ];
    if (isTopFrame) {
      this.listeners.push(
        ['copy', this.onClipboard.bind(this), PASSIVE_CAPTURE],
        ['paste', this.onClipboard.bind(this), PASSIVE_CAPTURE],
        ['cut', this.onClipboard.bind(this), PASSIVE_CAPTURE],
        ['pointerdown', this.onPointerDown.bind(this), PASSIVE_CAPTURE],
        ['pointerup', this.onPointerUp.bind(this), PASSIVE_CAPTURE],
        ['dragend', this.onDragEnd.bind(this), PASSIVE_CAPTURE],
        ['mouseover', this.onMouseOver.bind(this), PASSIVE_CAPTURE],
        ['mouseout', this.onMouseOut.bind(this), PASSIVE_CAPTURE],
      );
      localStorage
        .get(['targetColor'])
        .then(({ targetColor }) => {
          if (typeof targetColor === 'string' && targetColor) this.ring.setColor(targetColor);
        })
        .catch(() => {});
    }
    // Until this frame has read the settings, assume typed text is hidden: a frame that loads
    // mid-interview must not record a value in its first moments.
    hideTypedText(true);
    localStorage
      .get(['recordKeys', 'recordTyping', 'hideTypedText', 'interviewMode'])
      .then(({ recordKeys, recordTyping, hideTypedText: hideSetting, interviewMode }) => {
        this.recordKeys = recordKeys === true;
        this.recordTyping = recordTyping !== false;
        this.hideTyped = { setting: hideSetting === true, interview: interviewMode === true };
        hideTypedText(this.hideTyped.setting || this.hideTyped.interview);
      })
      .catch(() => {});
    browser.storage.local.onChanged.addListener(this.onSettingsChanged);
    // In a ValueScout interview, the interview page itself is never recorded: its own buttons
    // (Stop recording, Send) are not part of the work being shown.
    this.listeners = this.listeners.map(([event, handler, opts]) => [
      event,
      (e: Event) => {
        if (!this.onInterviewPage()) handler(e);
      },
      opts,
    ]);
    for (const [event, handler, opts] of this.listeners) {
      window.addEventListener(event, handler, opts);
    }
  }

  private onInterviewPage(): boolean {
    return this.hideTyped.interview && interviewHosts.has(location.host) && location.hash.startsWith('#/interview/');
  }

  // `now` reads the element's text and surroundings at once, for elements about to be removed
  // (a picked list option): read later, a detached option loses the layout that spaces its lines.
  private capture(action: StepAction, target: HTMLElement, point?: { x: number; y: number }, now = false) {
    const atEvent = freezeRect(target);
    const read = () => ({ meta: extractElementMeta(target, atEvent), context: extractDOMContext(target, action) });
    const early = now ? read() : null;
    return async () => {
      const placement = locateFrame();
      const { meta: elementMeta, context } = early ?? read();
      await this.sink.captureStep({
        guideId: this.guideId,
        action,
        elementMeta: placeInTab(point ? { ...elementMeta, clickPoint: point } : elementMeta, await placement),
        domContext: context,
      });
    };
  }

  private enqueue(task: () => Promise<unknown>) {
    this.busy = true;
    this.ring.hide();
    this.queue.add(async () => {
      await waitForPaint();
      await task();
    });
    this.queue.onIdle().then(() => {
      this.busy = false;
      if (this.hovered?.isConnected && !focusInEmbed()) this.ring.show(this.hovered);
    });
  }

  private hoverTarget(raw: EventTarget | null): HTMLElement | null {
    if (!(raw instanceof Element) || isMimikElement(raw)) return null;
    const target = findFocusableAncestor(raw);
    if (target === document.body || target === document.documentElement) return null;
    if (EMBED_TAGS.has(target.tagName) || isTooLarge(target)) return null;
    if (target.querySelector(EMBED_SELECTOR)) return null;
    return target;
  }

  private onMouseOver(e: Event) {
    const target = this.hoverTarget(eventTarget(e));
    if (target === this.hovered) return;
    this.hovered = target;
    if (this.busy) return;
    if (target && !focusInEmbed()) this.ring.show(target);
    else this.ring.hide();
  }

  private onMouseOut(e: Event) {
    const related = (e as MouseEvent).relatedTarget;
    if (related instanceof Element && this.hovered?.contains(related)) return;
    this.hovered = null;
    this.ring.hide();
  }

  private onClick(e: Event) {
    const me = e as MouseEvent;
    const raw = eventTarget(me);
    if (!raw || !(raw instanceof Element) || isReplayedClick(me) || me.shiftKey) return;
    const target = findFocusableAncestor(raw);
    if (isMimikElement(target)) return;
    const samePick = this.pickedOption?.contains(target) && Date.now() - this.pickedAt < REPEAT_CLICK_MS * 3;
    this.pickedOption = null;
    if (samePick) return;

    const now = Date.now();
    if (target === lastClickTarget && now - lastClickTime < REPEAT_CLICK_MS) return;
    lastClickTarget = target;
    lastClickTime = now;

    if (isTextField(target)) {
      this.startInput(target, freezeRect(target));
      return;
    }

    if (isNavigatingClick(target)) {
      me.preventDefault();
      me.stopImmediatePropagation();
      this.enqueue(this.capture('click', target, { x: me.clientX, y: me.clientY }));
      const anchor = target.closest('a[href]') as HTMLAnchorElement;
      if (anchor) {
        const href = anchor.href;
        requestAnimationFrame(() =>
          setTimeout(() => {
            window.location.href = href;
          }, INTERCEPT_DELAY_MS),
        );
      }
      return;
    }

    const task = this.capture('click', target, { x: me.clientX, y: me.clientY });

    if (!shouldInterceptClick(target, me)) {
      this.enqueue(task);
      return;
    }

    me.preventDefault();
    me.stopImmediatePropagation();
    const init = replayInit(me);
    this.enqueue(async () => {
      try {
        await Promise.race([task(), sleep(CAPTURE_BUDGET_MS)]);
      } catch (err) {
        logger.warn('Capture failed, replaying the click anyway', err);
      } finally {
        replayClick(target, init);
      }
    });
  }

  private onAuxClick(e: Event) {
    const raw = eventTarget(e);
    if (!raw || !(raw instanceof Element)) return;
    const target = findFocusableAncestor(raw);
    if (isMimikElement(target)) return;
    this.enqueue(this.capture('auxclick', target, { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }));
  }

  private onKeydown(e: Event) {
    const ke = e as KeyboardEvent;
    const resolved = eventTarget(ke);
    const target = resolved instanceof HTMLElement ? resolved : document.activeElement;
    if (!target || !(target instanceof HTMLElement) || isMimikElement(target)) return;

    if (this.input.active && (ke.key === 'Enter' || ke.key === 'Escape')) {
      this.enqueue(() => this.input.finalize());
      return;
    }

    if (isSensitiveField(target) || isTextField(target)) return;
    if (!this.recordKeys || !isRecordableKey(ke)) return;
    const held = { ctrl: ke.ctrlKey, alt: ke.altKey, shift: ke.shiftKey, meta: ke.metaKey };
    this.enqueue(this.capture(`keydown:${keyCombo(held, ke.key, MAC)}`, target));
  }

  private onInput(e: Event) {
    const target = eventTarget(e);
    if (!target || !(target instanceof HTMLElement)) return;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      )
    )
      return;

    if (target instanceof HTMLSelectElement) {
      this.enqueue(this.capture('input', target));
      return;
    }

    if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) return;
    if (!this.recordTyping) return;

    if (this.inputStarting === target) {
      this.enqueue(async () => this.input.update(target));
    } else if (this.input.active && this.input.target === target) {
      this.input.update(target);
    } else {
      this.startInput(target);
    }
  }

  private startInput(target: HTMLElement, atEvent?: FrozenRect) {
    if (this.inputStarting === target || (this.input.active && this.input.target === target)) return;
    this.inputStarting = target;
    this.enqueue(async () => {
      try {
        if (this.input.active && this.input.target !== target) await this.input.finalize();
        if (!this.input.active) await this.input.start(target, atEvent);
      } finally {
        if (this.inputStarting === target) this.inputStarting = null;
      }
    });
  }

  private onFocusOut(e: Event) {
    if (!this.input.active) return;
    const related = (e as FocusEvent).relatedTarget;
    if (related instanceof Element && related === this.input.target) return;
    this.enqueue(() => this.input.finalize());
  }

  private onClipboard(e: Event) {
    const resolved = eventTarget(e);
    const target = resolved instanceof HTMLElement ? resolved : document.activeElement;
    if (!target || !(target instanceof HTMLElement) || isMimikElement(target)) return;
    this.enqueue(this.capture(e.type as 'copy' | 'paste' | 'cut', target));
  }

  private onPointerDown(e: Event) {
    this.ring.hide();
    const pe = e as PointerEvent;
    this.dragStartX = pe.pageX;
    this.dragStartY = pe.pageY;
    this.dragStartElement = eventTarget(pe);

    // Comboboxes commit a pick on pointerdown and unmount the list, so no click ever
    // reaches the option. Record the pick here instead.
    const option = this.dragStartElement instanceof Element ? this.dragStartElement.closest('[role=option]') : null;
    this.pickedOption = null;
    if (pe.button !== 0 || !(option instanceof HTMLElement) || isMimikElement(option)) return;
    this.pickedOption = option;
    this.pickedAt = Date.now();
    this.enqueue(this.capture('click', option, { x: pe.clientX, y: pe.clientY }, true));
  }

  private onPointerUp(e: Event) {
    const pe = e as PointerEvent;
    if (this.dragStartX == null || this.dragStartY == null || !this.dragStartElement) {
      this.dragStartX = this.dragStartY = null;
      this.dragStartElement = null;
      return;
    }

    const dx = Math.abs(pe.pageX - this.dragStartX);
    const dy = Math.abs(pe.pageY - this.dragStartY);

    if (dx >= DRAG_MIN_PX || dy >= DRAG_MIN_PX) {
      const target = findFocusableAncestor(this.dragStartElement);
      if (!isMimikElement(target)) this.enqueue(this.capture('drag', target));
    }

    this.dragStartX = this.dragStartY = null;
    this.dragStartElement = null;
  }

  private onDragEnd(e: Event) {
    const target = eventTarget(e);
    if (!target || isMimikElement(target)) return;
    this.enqueue(this.capture('drag', findFocusableAncestor(target)));
  }

  stop(): Promise<void> {
    browser.storage.local.onChanged.removeListener(this.onSettingsChanged);
    for (const [event, handler, opts] of this.listeners) {
      window.removeEventListener(event, handler, opts);
    }
    this.hovered = null;
    this.ring.dispose();
    this.queue.add(() => this.input.finalize());
    return this.queue.onIdle();
  }
}

export function startCapture(
  guideId: string,
  isTopFrame = true,
  sink: CaptureSink = extensionCaptureSink,
): CaptureHandle {
  const controller = new CaptureController(guideId, isTopFrame, sink);
  return {
    stop: () => controller.stop(),
  };
}
