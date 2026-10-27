import { logger } from '@mimik/core/logger';
import { isLive } from '@/core/capture/is-live';
import { trimUrl } from '@/core/transfer/bundle';
import { getTab } from '@/lib/browser-api/get-tab';
import { localStorage } from '@/lib/browser-api/local-storage';
import { onHistoryStateUpdated } from '@/lib/browser-api/on-history-state-updated';
import { onNavigationCompleted } from '@/lib/browser-api/on-navigation-completed';
import { onTabActivated } from '@/lib/browser-api/on-tab-activated';
import { onTabUpdated } from '@/lib/browser-api/on-tab-updated';
import { sendMessageToTab } from '@/lib/browser-api/send-message-to-tab';
import { TabMessage } from '@/lib/tab-messages';
import { getActor, waitUntilReady } from './actor';
import { injectContentScript, isInjectableTab } from './tab-manager';

// In a ValueScout interview the page URL carries the invite token in its hash; Mimik's state
// (and its session-storage snapshot) keeps only origin and path.
async function pageUrl(url: string): Promise<string> {
  const { interviewMode } = await localStorage.get(['interviewMode']);
  return interviewMode === true ? trimUrl(url, 'path') : url;
}

export function registerNavigationListeners() {
  onNavigationCompleted(async (details) => {
    if (details.frameId !== 0) return;
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (isLive(state.value)) {
      logger.debug('URL changed (navigation) →', details.url);
      getActor().send({ type: 'URL_CHANGED', url: await pageUrl(details.url) });
    }
  });

  onHistoryStateUpdated(async (details) => {
    if (details.frameId !== 0) return;
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (isLive(state.value)) {
      logger.debug('URL changed (SPA pushState) →', details.url);
      getActor().send({ type: 'URL_CHANGED', url: await pageUrl(details.url) });
    }
  });

  onTabActivated(async (activeInfo) => {
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (!isLive(state.value)) return;
    if (!state.context.currentGuideId) return;

    try {
      await sendMessageToTab(activeInfo.tabId, { type: TabMessage.PING });
      logger.debug('Tab switched → content script alive on tab', activeInfo.tabId);
    } catch {
      logger.debug('Tab switched → injecting content script on tab', activeInfo.tabId);
      try {
        const tab = await getTab(activeInfo.tabId);
        if (isInjectableTab(tab)) {
          await injectContentScript(activeInfo.tabId);
        }
      } catch {}
    }
  });

  onTabUpdated(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (!isLive(state.value)) return;
    if (!isInjectableTab(tab)) return;

    try {
      await sendMessageToTab(tabId, { type: TabMessage.PING });
    } catch {
      logger.debug('Tab loaded → injecting content script on tab', tabId);
      try {
        await injectContentScript(tabId);
      } catch {}
    }
  });
}
