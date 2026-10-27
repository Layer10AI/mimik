import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureState } from '@/core/capture/machine';
import type { ElementMeta } from '@/core/guides/types';

const interviewUrl = 'https://valuescout.layer10.ai/?ref=mail#/interview/secret-token';
const writeStep = vi.fn().mockResolvedValue({});
let settings: Record<string, unknown> = {};

vi.mock('../actor', () => ({
  getActor: () => ({
    getSnapshot: () => ({
      value: CaptureState.RECORDING,
      context: { stepCount: 0, currentGuideId: 'guide-1', currentUrl: interviewUrl },
    }),
    send: vi.fn(),
  }),
}));
vi.mock('@/core/capture/write-step', () => ({ writeStep: (...args: unknown[]) => writeStep(...args) }));
vi.mock('@/core/guides/service', () => ({ saveScreenshot: vi.fn() }));
vi.mock('@/lib/browser-api/capture-visible-tab', () => ({
  captureVisibleTab: vi.fn().mockRejectedValue(new Error('no tab in tests')),
}));
vi.mock('@/lib/browser-api/local-storage', () => ({
  localStorage: { get: vi.fn(async () => settings) },
}));
vi.mock('@mimik/core/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../voice', () => ({ getVoiceUpdate: () => ({ phase: 'idle' }), flushNarrationForStep: vi.fn() }));

const meta = { rect: { x: 0, y: 0, width: 10, height: 10 }, devicePixelRatio: 1 } as ElementMeta;

async function storedUrl() {
  const { handleCaptureStep } = await import('../step-pipeline');
  await handleCaptureStep({ guideId: 'guide-1', action: 'click', elementMeta: meta } as never);
  return (writeStep.mock.calls.at(-1)![0] as { place: { url: string } }).place.url;
}

beforeEach(() => {
  writeStep.mockClear();
  settings = {};
});

describe('step URLs in a ValueScout interview', () => {
  it('drop the query and hash, so the invite token is never stored', async () => {
    settings = { interviewMode: true };
    expect(await storedUrl()).toBe('https://valuescout.layer10.ai/');
  });

  it('are kept whole in an ordinary recording', async () => {
    expect(await storedUrl()).toBe(interviewUrl);
  });
});
