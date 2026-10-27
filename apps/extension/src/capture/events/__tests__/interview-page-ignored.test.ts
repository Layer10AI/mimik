// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/lib/messaging';
import { type CaptureHandle, startCapture } from '../handlers';

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));

const { settings } = vi.hoisted(() => ({ settings: { value: {} as Record<string, unknown> } }));
vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn(async () => settings.value), set: vi.fn().mockResolvedValue(undefined) },
}));

let handle: CaptureHandle;

function button(): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = 'Stop recording';
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ x: 4, y: 6, top: 6, left: 4, right: 124, bottom: 46, width: 120, height: 40 }),
  });
  document.body.appendChild(el);
  return el;
}

function click(el: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
  Object.defineProperty(event, 'isTrusted', { configurable: true, value: true });
  el.dispatchEvent(event);
}

async function settle(turns = 16) {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function clicksRecordedAt(url: string, interviewMode: boolean) {
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);
  settings.value = { interviewMode };
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    setTimeout(() => cb(0), 0);
    return 0;
  });
  vi.mocked(sendMessage).mockReset();
  vi.mocked(sendMessage).mockResolvedValue({ stepId: 'step-1' } as never);
  handle = startCapture('guide-1');
  await settle();
  click(button());
  await settle();
  return vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'captureStep').length;
}

afterEach(() => {
  handle.stop();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('the ValueScout interview page in interview mode', () => {
  const interview = 'https://valuescout.layer10.ai/#/interview/3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';

  it('is not recorded', async () => {
    expect(await clicksRecordedAt(interview, true)).toBe(0);
  });

  it('is recorded like any page when Mimik is used on its own', async () => {
    expect(await clicksRecordedAt(interview, false)).toBe(1);
  });

  it('is not recorded before the settings have loaded', async () => {
    settings.value = { interviewMode: true };
    const { localStorage } = await import('@/lib/browser-api/local-storage');
    vi.mocked(localStorage.get).mockReturnValueOnce(new Promise(() => {}) as never);
    (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(interview);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      setTimeout(() => cb(0), 0);
      return 0;
    });
    vi.mocked(sendMessage).mockReset();
    vi.mocked(sendMessage).mockResolvedValue({ stepId: 'step-1' } as never);
    handle = startCapture('guide-1');
    click(button());
    await settle();
    expect(vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'captureStep')).toHaveLength(0);
  });

  it('leaves the rest of the app recorded during the interview', async () => {
    expect(await clicksRecordedAt('https://valuescout.layer10.ai/#/org/org-1/campaigns', true)).toBe(1);
  });
});
