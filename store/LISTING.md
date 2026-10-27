# Chrome Web Store listing: ValueScout Show-me

Text to paste into the Chrome Web Store developer dashboard for the store build (`VALUESCOUT_STORE=1 pnpm build`, or the `valuescout-show-me-store-<sha>.zip` attached to each `valuescout-<sha>` release).

## Store listing

**Name:** ValueScout Show-me

**Summary (132 characters max):**
Show your ValueScout interviewer how you do your work: records your clicks as steps with screenshots.

**Description:**
ValueScout Show-me lets you show your work during a ValueScout interview, instead of only describing it.

When your interviewer has switched on screen sharing, the interview page offers to record with ValueScout Show-me. Start it, then do the task the way you normally would in your other tabs. Each click and field becomes a named step, such as "Click Create invoice", with a screenshot that highlights what you clicked.

You see every step and screenshot on the interview page before anything is sent, and you can remove any of them. They go to your interviewer only with your next answer.

What it never does:
- It never records what you type into fields. Steps name the field, not its contents.
- It doesn't record the interview page itself.
- It sends nothing anywhere unless you start a recording from your ValueScout interview.

Based on Mimik, the open-source step recorder by Westpoint (MIT licence).

**Category:** Workflow & Planning (alternative: Productivity)

**Language:** English

## Privacy practices tab

**Single purpose:**
Record the steps a person takes in their browser, with screenshots, so they can show them in their ValueScout interview.

**Permission justifications:**

| Permission | Why it's needed |
|---|---|
| Host access to all sites | The person shows their own work, which happens on whatever sites and tools they use. The extension records clicks and takes the screenshot on the page they're working in, so it must run on those pages. It does this only while a recording is running. |
| `activeTab` | To take the screenshot of the tab the person is working in when they click. |
| `tabs` | To follow the person across tabs during a recording (opening a link in a new tab is part of the work), and to find the ValueScout interview tab that started the recording. |
| `scripting` | To add the step recorder to tabs that were already open before the extension was installed or updated. |
| `webNavigation` | To note which page each step happened on, so steps stay in order when the person moves between pages. |
| `storage` | To keep settings, and to know whether a recording is running if the browser restarts the extension mid-recording. |
| `unlimitedStorage` | Steps and screenshots are kept locally until they're sent with an answer, and screenshots can exceed the default storage quota. |
| `sidePanel` | To show the recording controls and recorded steps in Chrome's side panel. |
| `offscreen` | To keep the microphone open in a background page for the optional voice narration feature. It's used only when the person turns narration on. |

**Remote code:** No. All code is packaged in the extension.

**Data usage:** tick these categories.
- **Website content:** screenshots of pages the person records, and the names of the buttons and fields they click.
- **User activity:** the clicks and page changes during a recording.

Then certify all three statements:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://valuescout.layer10.ai/privacy/show-me.html

## Distribution

**Visibility:** Private, shared with the Layer10 Google Workspace domain (or named trusted testers) to start. Switch to Unlisted when clients' interviewees need it.

**Regions:** All regions.

## Assets still needed

- **Screenshots:** 1–5 images at 1280×800 or 640×400. Suggested shots:
  1. the interview page with recorded steps and screenshots before sending
  2. the button that starts a recording on the interview page
  3. the consultant view with the screenshots
- **Small promo tile (optional):** 440×280.
- **Store icon:** 128×128. It's in the zip at `valuescout/icon128.png`.
