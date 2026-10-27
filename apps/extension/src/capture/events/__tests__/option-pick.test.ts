// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
}));

let handle: CaptureHandle;

function place(html: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  for (const el of wrapper.querySelectorAll('*')) {
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ x: 4, y: 6, top: 6, left: 4, right: 124, bottom: 46, width: 120, height: 40 }),
    });
  }
  document.body.appendChild(wrapper);
  return wrapper;
}

function press(el: Element) {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 20 }));
}

function click(el: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
  Object.defineProperty(event, 'isTrusted', { configurable: true, value: true });
  el.dispatchEvent(event);
}

function capturedSteps() {
  return vi
    .mocked(sendMessage)
    .mock.calls.filter(([type]) => type === 'captureStep')
    .map(([, data]) => data as { action: string; elementMeta: { text?: string } });
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
  handle = startCapture('guide-1');
});

afterEach(() => {
  handle.stop();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('picking from a list', () => {
  it('records a pick when the list closes on pointerdown, before any click', async () => {
    const page = place('<ul role="listbox"><li role="option">Dubai, United Arab Emirates</li></ul>');
    const option = page.querySelector('[role=option]')!;
    press(option);
    page.remove();
    await settle();

    expect(capturedSteps()).toHaveLength(1);
    expect(capturedSteps()[0]!.action).toBe('click');
  });

  it('records one step when a click still follows the pick', async () => {
    const page = place('<ul role="listbox"><li role="option"><span>1-50 employees</span></li></ul>');
    const label = page.querySelector('span')!;
    press(label);
    click(label);
    await settle();

    expect(capturedSteps()).toHaveLength(1);
  });

  it('leaves ordinary buttons to the click handler', async () => {
    const page = place('<button>Save</button>');
    const button = page.querySelector('button')!;
    press(button);
    await settle();
    expect(capturedSteps()).toHaveLength(0);

    click(button);
    await settle();
    expect(capturedSteps()).toHaveLength(1);
  });
});
