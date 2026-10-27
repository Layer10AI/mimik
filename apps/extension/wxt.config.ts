import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "wxt";

// VALUESCOUT_STORE=1 builds the Chrome Web Store package: ValueScout's own name and icons, and no
// fixed key (the store assigns the id). Plain builds stay the tester build with the fixed id.
const store = process.env.VALUESCOUT_STORE === "1";
const storeName = "ValueScout Show-me";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  srcDir: "src",
  imports: false,
  i18n: { localesDir: '../../packages/locales' },
  webExt: {
    chromiumArgs: ['--user-data-dir=/tmp/mimik-dev-profile', '--window-size=1280,800', '--window-position=0,0', '--force-device-scale-factor=1.25'],
  },
  zip: {
    sourcesRoot: '../..',
    excludeSources: [
      "coverage/**",
      "apps/desktop/dist/**",
      "apps/desktop/out/**",
      "packages/capture-native/target/**",
      "mockups/**",
      "docs/**",
      ".claude/**",
      ".planning/**",
      ".worktrees/**",
      "CLAUDE.md",
      "AGENTS.md",
      "CONTRIBUTING.md",
    ],
  },
  alias: {
    '@mimik/core': '../../packages/core/src',
    '@mimik/ui': '../../packages/ui/src',
    '@/core': '../../packages/core/src',
    '@': 'src',
    canvg: '../../packages/core/src/export/empty.ts',
    html2canvas: '../../packages/core/src/export/empty.ts',
    dompurify: '../../packages/core/src/export/empty.ts',
  },
  vite: () => ({
    plugins: [tailwindcss()],
    // Read by ValueScoutMark: the store build swaps Mimik's mascot for ValueScout's mark.
    define: { __VALUESCOUT_STORE__: JSON.stringify(store) },
  }),
  hooks: {
    // The store build shows its own name wherever the interface would say Mimik.
    'build:done': (wxt) => {
      if (!store) return;
      const locales = join(wxt.config.outDir, "_locales");
      for (const locale of readdirSync(locales)) {
        const file = join(locales, locale, "messages.json");
        // Only the shown text: message keys (like onboarding_openMimik) must stay valid identifiers.
        const messages: Record<string, { message: string }> = JSON.parse(readFileSync(file, "utf8"));
        for (const entry of Object.values(messages)) entry.message = entry.message.replaceAll("Mimik", storeName);
        writeFileSync(file, JSON.stringify(messages));
      }
      // Page titles show in the tab when onboarding or the side panel opens as a page.
      for (const page of readdirSync(wxt.config.outDir, { recursive: true }).map(String)) {
        if (!page.endsWith(".html")) continue;
        const file = join(wxt.config.outDir, page);
        writeFileSync(file, readFileSync(file, "utf8").replace(/<title>([^<]*)<\/title>/, (_, title: string) => `<title>${title.replaceAll("Mimik", storeName)}</title>`));
      }
    },
    'build:manifestGenerated': (wxt, manifest) => {
      if (wxt.config.browser === 'firefox' && manifest.sidebar_action) {
        (manifest.sidebar_action as Record<string, unknown>).open_at_install = false;
        (manifest.sidebar_action as Record<string, unknown>).default_icon = 'icon32.png';
      }
    },
  },
  manifest: ({ browser }) => {
    const isFirefox = browser === 'firefox';
    return {
      name: store ? storeName : "__MSG_app_store_title__",
      description: store
        ? "Show your ValueScout interviewer how you do your work: records your clicks as steps with screenshots."
        : "__MSG_app_description__",
      default_locale: "en",
      // ValueScout spike: lets the interview page start a recording and take its steps.
      externally_connectable: { matches: ["https://valuescout.layer10.ai/*"] },
      // Fixed public key, so every unpacked install has the extension id the ValueScout interview
      // page expects (dcijdocmnoghlfppljeiclnjigefhodn). A Web Store listing assigns its own id.
      ...(isFirefox || store ? {} : { key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwgHHf6WroylaVXtF4D05H0wjqlvhHdY10RcPkDVwBkODzm5NGPQ8SVRZ1om9DpV8ka+5Rjf8tr9mNVDeCWhkyi/qdBVCIARhx+9FRRjlPEDFi+kps0dAhBbTqH5Bdv57l3xMizLdMLpf5Lk6cJkbNP2z8BPdBDJAqpFdjMXWsI6h0ldxuG1xV+HDNsaRYfqYpjPv0xR3Jzlf8lSpxnCeWzNjwtt09y8srYnQ+XWyWUM1KNHApkirBpt1nW3W0DdslMkVP2cRgnFp9zIJ1Hu2fOrpCUfccxivNXiQcKSBIevMMywOvsmM6xWS4f6kZS3FoR8c3iEYMNJx5pIblAzyfQIDAQAB" }),
      permissions: [
        "storage",
        "activeTab",
        "tabs",
        "scripting",
        "unlimitedStorage",
        "webNavigation",
        ...(isFirefox ? [] : ["sidePanel", "offscreen"]),
      ],
      ...(isFirefox
        ? { optional_host_permissions: ["<all_urls>"] }
        : { host_permissions: ["<all_urls>"], minimum_chrome_version: "118" }),
      icons: store
        ? {
            16: 'valuescout/icon16.png',
            32: 'valuescout/icon32.png',
            48: 'valuescout/icon48.png',
            128: 'valuescout/icon128.png',
          }
        : {
            16: 'icon16.png',
            32: 'icon32.png',
            48: 'icon48.png',
            128: 'icon128.png',
          },
      action: {},
      ...(isFirefox
        ? {
            sidebar_action: {
              default_panel: "sidepanel.html",
              default_icon: "icon32.png",
              default_title: "Mimik",
              open_at_install: false,
            },
            browser_specific_settings: {
              gecko: {
                id: "mimik@westpoint.io",
                strict_min_version: "128.0",
                data_collection_permissions: {
                  required: ["websiteActivity"],
                  optional: [
                    "websiteContent",
                    "personallyIdentifyingInfo",
                  ],
                },
              },
            },
          }
        : {
            side_panel: {
              default_path: "sidepanel/index.html",
            },
          }),
    };
  },
});
