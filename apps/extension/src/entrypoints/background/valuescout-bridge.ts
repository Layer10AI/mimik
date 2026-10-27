import { browser } from '#imports';
import { actionSteps } from '@/core/guides/blocks';
import { getScreenshotsForSteps, getStepsForGuide } from '@/core/guides/service';
import { renderScreenshot } from '@/core/screenshot/render';
import { localStorage } from '@/lib/browser-api/local-storage';

// ValueScout spike: the interview page drives a recording over externally_connectable with
// one-shot messages, so a service worker restart mid-recording loses nothing. The page keeps
// the guide id and how many steps it has taken; the guide also stays in Mimik's library.
interface Recorder {
  start(url: string): Promise<{ guideId: string }>;
  stop(): Promise<unknown>;
  /** The guide being recorded right now, or null. */
  current(): string | null;
}

// The guide this bridge started. Pages may only read or stop that one, never the person's own guides.
const ownedGuideKey = 'valuescoutBridgeGuideId';

async function ownedGuide(): Promise<string | undefined> {
  return (await browser.storage.session.get(ownedGuideKey))[ownedGuideKey] as string | undefined;
}

// The invite token from an interview page URL (#/interview/<uuid>), or null for any other page.
function inviteToken(url: string | undefined): string | null {
  try {
    const match = /^#\/interview\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?]|$)/i.exec(
      new URL(url ?? '').hash,
    );
    return match ? match[1]!.toLowerCase() : null;
  } catch {
    return null;
  }
}

// A recording belongs to the invite that started it. Only a hash of the token is kept.
const ownedInviteKey = 'valuescoutBridgeInvite';

async function inviteHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function isOwnInvite(token: string): Promise<boolean> {
  const owned = (await browser.storage.session.get(ownedInviteKey))[ownedInviteKey];
  return owned === (await inviteHash(token));
}

type BridgeMessage =
  | { type: 'ping' }
  | { type: 'start' }
  | { type: 'take'; guideId: string; from: number }
  | { type: 'stop' };

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function stepsFrom(guideId: string, from: number) {
  const steps = actionSteps(await getStepsForGuide(guideId)).slice(from);
  const screenshots = await getScreenshotsForSteps(
    steps.flatMap((step) => (step.screenshotId ? [step.screenshotId] : [])),
  );
  return Promise.all(
    steps.map(async (step) => {
      const shot = screenshots.get(step.id);
      // No step.url: on the interview page it carries the invite token.
      // The whole frame, not Mimik's zoomed crop: Vera needs the page around the click.
      const viewport = shot && { x: 0, y: 0, width: shot.width, height: shot.height };
      const blob = shot?.blob ? await renderScreenshot(shot, { format: 'image/jpeg', quality: 0.85, viewport }) : null;
      return {
        text: step.description,
        takenAt: step.timestamp,
        dataUrl: blob && (await blobToDataUrl(blob)),
      };
    }),
  );
}

export function registerValueScoutBridge(recorder: Recorder): void {
  async function start(url: string, token: string) {
    if (recorder.current()) throw new Error('Mimik is already recording');
    // Only the origin: the interview URL carries the invite token, and Mimik keeps the start URL with the guide.
    // Interview mode: typed text stays out of steps and stored URLs lose their query and hash.
    await localStorage.set({ interviewMode: true });
    let guideId: string;
    try {
      ({ guideId } = await recorder.start(new URL(url).origin));
    } catch (err) {
      await endInterviewMode();
      throw err;
    }
    await browser.storage.session.set({ [ownedGuideKey]: guideId, [ownedInviteKey]: await inviteHash(token) });
    return { guideId };
  }

  async function take(guideId: string, from: number, token: string) {
    if (guideId !== (await ownedGuide()) || !(await isOwnInvite(token)))
      throw new Error('Not a guide this page started');
    return { steps: await stepsFrom(guideId, from) };
  }

  // Lets the page show its button, and pick a recording back up after a reload.
  async function ping(token: string) {
    const owned = await ownedGuide();
    const recording = !!owned && recorder.current() === owned && (await isOwnInvite(token));
    return { ok: true, version: browser.runtime.getManifest().version, guideId: recording ? owned : null };
  }

  async function stop(token: string) {
    if (!(await isOwnInvite(token))) throw new Error('Not a recording this page started');
    const owned = await ownedGuide();
    if (owned && recorder.current() === owned) await recorder.stop();
    return { stopped: true };
  }

  browser.runtime.onMessageExternal.addListener((message: BridgeMessage, sender, sendResponse) => {
    const reply = (work: Promise<unknown>) => {
      work.then(sendResponse, (err: unknown) => sendResponse({ error: String(err) }));
      return true;
    };
    // sender.url is the URL the page loaded with; the tab's URL follows in-app hash navigation.
    const url = sender.tab?.url ?? sender.url;
    const token = inviteToken(url);
    if (!token) return reply(Promise.reject(new Error('Only the interview page can record')));
    if (message?.type === 'ping') return reply(ping(token));
    if (message?.type === 'start') return reply(start(url!, token));
    if (message?.type === 'take') return reply(take(message.guideId, message.from, token));
    if (message?.type === 'stop') return reply(stop(token));
    return false;
  });
}

// Every way a recording ends clears interview mode, so the person's own later guides are unaffected.
export function endInterviewMode(): Promise<void> {
  return localStorage.set({ interviewMode: false });
}
