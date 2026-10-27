# ValueScout build of Mimik

This fork adds a bridge so the ValueScout interview page can record a person's steps and screenshots with Mimik and send them to Vera.

## Install a build

1. Open [Releases](https://github.com/Layer10AI/mimik/releases) and download the latest `valuescout-mimik-<commit>.zip`.
2. Unzip it into a folder you'll keep. Chrome loads the extension from that folder.
3. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Pin Mimik from the puzzle-piece menu.

Every build has the same extension id, `dcijdocmnoghlfppljeiclnjigefhodn`, which is what the interview page looks for.

## Update to a newer build

Download and unzip the newer release over the same folder, then click the reload icon on Mimik's card in `chrome://extensions`.

## Use it in an interview

The interview's campaign needs **Let interviewees show their screen to Vera** switched on. On the interview page, click **Show Vera with Mimik**, do the work in your other tabs, then send your answer. The steps and screenshots go with it, and you can remove any of them before sending.

These builds are for internal testing. They aren't published on the Chrome Web Store.
