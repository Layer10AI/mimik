// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hideTypedText } from '@/core/capture/dom/element-utils';
import { sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

const { settings } = vi.hoisted(() => ({
  settings: { load: Promise.resolve({}) as Promise<Record<string, unknown>> },
}));
vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn(() => settings.load), set: vi.fn().mockResolvedValue(undefined) },
}));

let handle: CaptureHandle;

function field(): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('aria-label', 'Industry');
  Object.defineProperty(input, 'getBoundingClientRect', {
    value: () => ({ x: 4, y: 6, top: 6, left: 4, right: 124, bottom: 46, width: 120, height: 40 }),
  });
  document.body.appendChild(input);
  return input;
}

function click(el: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
  Object.defineProperty(event, 'isTrusted', { configurable: true, value: true });
  el.dispatchEvent(event);
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function calls(type: string) {
  return vi
    .mocked(sendMessage)
    .mock.calls.filter(([t]) => t === type)
    .map(([, data]) => data as { action?: string; description?: string });
}

async function settle(turns = 16) {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    setTimeout(() => cb(0), 0);
    return 0;
  });
  vi.mocked(sendMessage).mockReset();
  vi.mocked(sendMessage).mockResolvedValue({ stepId: 'step-1' } as never);
  settings.load = Promise.resolve({});
});

afterEach(() => {
  handle.stop();
  hideTypedText(false);
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('starting a typing step', () => {
  it('makes one step when a keystroke arrives before the click has started it', async () => {
    handle = startCapture('guide-1');
    await settle();
    const input = field();
    click(input);
    type(input, 'bank');
    await settle();

    expect(calls('captureStep').filter((step) => step.action === 'input')).toHaveLength(1);
    expect(calls('updateInputStep').at(-1)?.description).toBe('steps.typeValueInto[bank,Industry]');
  });

  it('hides typed text until the frame has read its settings', async () => {
    settings.load = new Promise(() => {});
    handle = startCapture('guide-1');
    const input = field();
    type(input, 'Secret');
    await settle();
    type(input, 'Secret plan');
    await settle();

    expect(calls('updateInputStep').at(-1)?.description).toBe('steps.typeInto[Industry]');
  });
});
