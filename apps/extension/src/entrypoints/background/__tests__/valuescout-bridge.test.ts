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

import { endInterviewMode, registerValueScoutBridge } from '../valuescout-bridge';

const interview = 'https://valuescout.layer10.ai/#/interview/3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';
const otherInvite = 'https://valuescout.layer10.ai/#/interview/0b7e5d2c-1f3a-4c6b-8d9e-aa11bb22cc33';
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

  it('answers a ping, with the recording only for the invite that started it', async () => {
    expect(await send({ type: 'ping' })).toMatchObject({ ok: true, guideId: null });
    await send({ type: 'start' });
    expect(await send({ type: 'ping' })).toMatchObject({ ok: true, guideId: 'bridge-guide' });
    expect(await send({ type: 'ping' }, otherInvite)).toMatchObject({ ok: true, guideId: null });
  });

  it('refuses pages other than the interview page', async () => {
    const reply = await send({ type: 'start' }, 'https://valuescout.layer10.ai/#/org/org-1');
    expect(reply.error).toMatch(/interview page/);
    expect(recorder.start).not.toHaveBeenCalled();
  });

  it('turns on interview mode for the recording, and endInterviewMode turns it off', async () => {
    await send({ type: 'start' });
    expect((await fakeBrowser.storage.local.get('interviewMode')).interviewMode).toBe(true);
    await endInterviewMode();
    expect((await fakeBrowser.storage.local.get('interviewMode')).interviewMode).toBe(false);
  });

  it('turns interview mode back off when the recording fails to start', async () => {
    recorder.start.mockRejectedValueOnce(new Error('no tab'));
    expect((await send({ type: 'start' })).error).toMatch(/no tab/);
    expect((await fakeBrowser.storage.local.get('interviewMode')).interviewMode).toBe(false);
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

  it('refuses an interview URL that is not a real invite', async () => {
    const reply = await send({ type: 'start' }, 'https://valuescout.layer10.ai/#/interview/anything');
    expect(reply.error).toMatch(/interview page/);
    expect(recorder.start).not.toHaveBeenCalled();
  });

  it("a different invite can't read or stop this recording", async () => {
    await send({ type: 'start' });
    expect((await send({ type: 'take', guideId: 'bridge-guide', from: 0 }, otherInvite)).error).toMatch(/Not a guide/);
    expect((await send({ type: 'stop' }, otherInvite)).error).toMatch(/Not a recording/);
    expect(recorder.stop).not.toHaveBeenCalled();
  });

  it('keeps only a hash of the invite token', async () => {
    await send({ type: 'start' });
    const stored = JSON.stringify(await fakeBrowser.storage.session.get(null));
    expect(stored).not.toContain('3f2a9c1e');
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
