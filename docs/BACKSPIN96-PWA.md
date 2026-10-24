# BackSpin96 standalone PWA

The live booth is `https://michaelwave369.github.io/MoreBounceLabs/backspin.html`.
MoreBounceLabs still has its separate `#/decks` entrance.

## Installation
- Open the standalone booth over HTTPS.
- Chromium browsers may display **Install BackSpin96** when the browser makes the install prompt available. Otherwise use the browser's **Install app** menu; on mobile, **Add to Home Screen** may be available.
- The manifest launches the standalone `backspin.html` page. It does not install or duplicate the original audio engine.

## Optional offline preparation
1. While connected, open the standalone booth and choose **Prepare offline booth**.
2. The service worker reads the *current built deployment's* `backspin96-offline-index.json`. The build generates this list from the actual hashed bundle and the pinned, staged BackSpin runtime.
3. The worker rejects absent or unverified runtime staging, off-origin files, unsafe paths, and missing resources.
4. A completion message only appears after every listed app resource is fetched and cached.
5. Disconnect, restart the installed app, load **your own local music**, start dual audio with a user gesture, and verify both decks, scratching, hot cues, crossfader, recording, and any advanced features you need **before** relying on it in a live set.

This feature only caches app assets on the DJ's current device. No audio tracks, browser file handles, recordings, imported crates, external streamed music, or user credentials are uploaded or explicitly cached. The browser may evict cached assets. Offline readiness is not guaranteed until tested on the intended device.

The service worker only intercepts owned asset paths under `/MoreBounceLabs/` and avoids general navigation, unrelated sites, cross-origin players, and non-GET requests. The original `Backspin96 v1.5.0` source remains pinned by SHA-256 and unchanged.

## Maintenance / rollback
- Build with `npm run build:pages`, which emits both HTML entries and a runtime-specific offline inventory.
- Run `npm run verify:pages` to check icons, entrypoints, scope, and inventory safety.
- Deploying a new build changes Vite's hashed bundle resources. Revisit **Prepare offline booth** online after each update.
- To roll back, revert the PWA commit. The standalone booth and the MoreBounceLabs Decks room are independent of the offline controls.

## QA limitations
CI verifies the artifact structure. It does **not** replace real-browser testing of PWA installation, offline boot, file pickers, Web Audio, AudioWorklets, MIDI and microphone permission prompts. Offline music is loaded intentionally by the DJ and is never part of the offline asset pack.
