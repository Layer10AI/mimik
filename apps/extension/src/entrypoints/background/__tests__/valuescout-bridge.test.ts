import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

type Listener = (
  message: unknown,
  sender: { url?: string; tab?: { url?: string } },
  reply: (value: unknown) => void,
) => boolean;

vi.mock('@/core/guides/service', () => ({
  getStepsForGuide: async (guideId: string) =>
    ['one', 'two', 'three'].map((text, index) => ({
      id: `${guideId}-${index}`,
      description: text,
      timestamp: index,
      url: 'https://valuescout.layer10.ai/#/interview/secret-token',
    })),
  getScreenshotsForSteps: async () => new Map(),
}));

vi.mock('@/core/screenshot/render', () => ({ renderScreenshot: vi.fn() }));

import { registerValueScoutBridge } from '../valuescout-bridge';

const interview = 'https://valuescout.layer10.ai/#/interview/secret-token';
let current: string | null;
const recorder = {
  start: vi.fn(async (_url: string) => {
    current = 'bridge-guide';
    return { guideId: 'bridge-guide' };
  }),
  stop: vi.fn(async () => {
    current = null;
  }),
  current: () => current,
};

let listener: Listener;

function send(message: unknown, url = interview): Promise<Record<string, unknown>> {
  return new Promise((resolve) => listener(message, { url }, resolve as (value: unknown) => void));
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(fakeBrowser.runtime.onMessageExternal, 'addListener').mockImplementation((fn) => {
    listener = fn as unknown as Listener;
  });
  current = null;
  recorder.start.mockClear();
  recorder.stop.mockClear();
  registerValueScoutBridge(recorder);
});

describe('ValueScout bridge', () => {
  it('starts a recording with only the page origin, never the invite token', async () => {
    expect(await send({ type: 'start' })).toEqual({ guideId: 'bridge-guide' });
    expect(recorder.start).toHaveBeenCalledWith('https://valuescout.layer10.ai');
  });

  it('refuses pages other than the interview page', async () => {
    const reply = await send({ type: 'start' }, 'https://valuescout.layer10.ai/#/org/org-1');
    expect(reply.error).toMatch(/interview page/);
    expect(recorder.start).not.toHaveBeenCalled();
  });

  it("checks the tab's current URL, not the one the page loaded with", async () => {
    const stale = (message: unknown, tabUrl: string) =>
      new Promise<Record<string, unknown>>((resolve) =>
        listener(message, { url: interview, tab: { url: tabUrl } }, resolve as (value: unknown) => void),
      );
    expect((await stale({ type: 'start' }, 'https://valuescout.layer10.ai/#/org/org-1')).error).toMatch(
      /interview page/,
    );
    expect(await stale({ type: 'start' }, interview)).toEqual({ guideId: 'bridge-guide' });
  });

  it("won't take over a recording the person started in Mimik", async () => {
    current = 'their-own-guide';
    expect((await send({ type: 'start' })).error).toMatch(/already recording/);
    expect(recorder.start).not.toHaveBeenCalled();
  });

  it('returns steps after `from`, without their URLs', async () => {
    await send({ type: 'start' });
    const { steps } = await send({ type: 'take', guideId: 'bridge-guide', from: 1 });
    expect(steps).toEqual([
      { text: 'two', takenAt: 1, dataUrl: null },
      { text: 'three', takenAt: 2, dataUrl: null },
    ]);
  });

  it("refuses to read a guide it didn't start", async () => {
    await send({ type: 'start' });
    expect((await send({ type: 'take', guideId: 'their-own-guide', from: 0 })).error).toMatch(/Not a guide/);
  });

  it('stops only its own recording', async () => {
    await send({ type: 'start' });
    current = 'their-own-guide';
    await send({ type: 'stop' });
    expect(recorder.stop).not.toHaveBeenCalled();
    current = 'bridge-guide';
    await send({ type: 'stop' });
    expect(recorder.stop).toHaveBeenCalledOnce();
  });
});
