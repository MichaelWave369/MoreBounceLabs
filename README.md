# MoreBounceLabs

A local-first music experience by **Mikey More Bounce**, with an album vault, listening lounge, visual lab, radio stations, two DJ decks, browser-local favorites and playlists, and a persistent player.

## Catalog integrity

The committed catalog lives at `public/catalog/albums.json`: **19 albums and 344 tracks** at the October 2026 import baseline. Its existing titles, Suno IDs, source references, artwork, and album ordering must be preserved unless the artist explicitly edits the catalog. The baseline is enforced by `scripts/house-logic.test.mjs`.

The app references remote Suno media and embeds. **A track in the catalog is not proof that playback is available to every visitor.** Direct streaming depends on the remote host and browser restrictions; official Suno embed fallback is available in the main player. Do not bypass access controls or treat undocumented clip links as a permanent distribution contract. For long-term independence, prefer properly licensed, artist-controlled audio hosting.

## Run locally

Requires Node.js 22 and npm:

```bash
npm install
npm run dev
```

The exported lockfile currently fails a clean `npm ci` because some transitive dependencies are out of sync. `npm install` reconciles those versions during installation; a future cleanup should commit a refreshed lockfile so CI can return to strict `npm ci`.

The development server listens at `http://localhost:8080`.

## Checks

```bash
npm run typecheck
node --test scripts/house-logic.test.mjs
npm run lint
npm run build
```

The inherited Grok platform test suite (`npm test`) currently includes PWA identity tests that fail against this branded export (8 failures observed on the initial GitHub Actions run). This first-flight CI checks the music-house regression tests separately; the full inherited suite still needs an isolated-fixture cleanup before it should become a required gate.

The project retains its **TanStack Start + Nitro/Vercel** build as well as a separate Vite static GitHub Pages build. The original `mictek-house` Pages site is a distinct legacy deployment and is not modified by this repository.

## Rooms

- **Lobby:** featured releases and entry points.
- **Vault:** album gallery, search, sort, and viewing styles.
- **Lounge:** queue, Now Playing, sleep timer, visualizer.
- **Lab:** ten visualizer modes, with ambient fallback if audio analysis is unavailable.
- **Radio:** automatically assembled stations based on album titles, not invented genre labels.
- **Decks:** two separate audio elements and a volume crossfader. No beatmatching claim.
- **Desk:** browser-local favorites, playlists, history, and catalog export.

## First-flight stability improvements

- Both DJ decks bind their selected album's first authorized HTTPS track at initial render and on selection changes. The listener no longer has to switch away from an album to load it.
- Queue movements preserve the identity of the active track when an adjacent item crosses the playing cursor. Regression tests cover each direction and invalid indices.
- Desk instructions refer to this repository instead of the original Pages repository.

## Next recommended milestones

1. Verify playback and official embed fallback on a real desktop and mobile browser.
2. Confirm intended hosting and public URL; build deployment validation around that target.
3. Improve media error handling and playback recovery with source-level integration tests.
4. Add track deep-link behavior and accessible mobile player testing.
5. Expand the DJ deck only after its audio-source limitations are understood.

## Shareable song links

Song URLs like `#/album/trunk-funk/3` now select and highlight the fourth song (the existing URL convention is **zero-based**) with a **Play this song** action. These links do not autoplay, because browsers often block media without a direct tap. Invalid or out-of-bounds indexes show a friendly message, leaving the rest of the album usable. Album-only links still open normally.

Hash routing is compatible with simple static navigation but does not create individually server-rendered track previews for social-media crawlers.

## GitHub Pages (static React build)

This repo includes a separate static build so GitHub Pages does not need TanStack Start, Nitro, Vercel, PGLite, or a server.

- **Expected public URL after deployment:** https://michaelwave369.github.io/MoreBounceLabs/
- **Run locally:** `npm install` then `npm run build:pages`
- **Verify:** `npm run verify:pages`
- **Output folder:** `dist-pages/`
- **CI:** Pull requests verify both the existing server-oriented build and the static Pages build.
- **Publish:** Merge the Pages deployment PR to `main`. GitHub Actions runs `.github/workflows/pages.yml`, uploads the static build and deploys it with `actions/deploy-pages`.

**Important GitHub setting:** Under **Settings → Pages → Build and deployment**, choose **Source: GitHub Actions**. If Pages has never been enabled, this one-time repository setting may be required before the deploy job succeeds. No repository secrets or paid hosting are needed.

This is a **second deployment target**. The original `mictek-house` GitHub Pages site remains unchanged, and this build does not attempt to host a server-side auth/database backend. Hash routes like `#/album/trunk-funk/3` remain on the same static `index.html` path and are safe to refresh. The catalog request uses Vite's base URL, so it resolves to `/MoreBounceLabs/catalog/albums.json` on Pages, not the domain root. It is still subject to Suno/media-host playback rules and browser restrictions.

## Unified playback controls

The public catalog includes 344 Suno clips with undocumented clip-host URLs. The main player now **opens the official Suno embed first** for those tracks, instead of attempting a blocked direct stream and showing a second player beneath fake controls.

- **Suno embed mode:** only the official embedded player offers Play, Pause, seek, and volume. The house shows an honest selected-track label and explicit **Previous song / Next song** selectors. Selecting another song reloads the embed; **automatic advance, exact playback state, native volume, seek, sleep timer, and Media Session controls are not supported for cross-origin embeds**.
- **Native mode:** independent artist-hosted HTTPS audio uses the house transport controls, seek, queue, speed, media session and sleep timer.
- **Fallback:** if native playback for a track with a valid Suno ID fails, transition to the official embed and stop/clear the native audio element.
- **Visualizer:** Suno embed mode is ambient only; it does not claim access to audio analysis.

This is intentionally an honest two-source adapter, not an attempt to control or bypass Suno's cross-origin player. The Site cannot directly start the music inside a third-party iframe; visitors must tap Play inside the official player. The existing catalog is unchanged.

## Public brand

The **site and application** are named **MoreBounceLabs**, shortened to **MBL** in compact UI. The old public-facing “MicTek House” branding has been removed from the navigation, player, browser title, PWA/OG metadata, static Pages HTML and no-script message. Artist attribution and pre-existing technical paths/legacy repository links are retained where they still have meaning.

## Experimental MBL DJ Bot Lab (local only)

The first DJ Bot rung lives in `scripts/dj-bot-lab.mjs`. **It does not operate Suno.** It opens a private local Playwright browser with a simulated embedded player hosted on two different localhost ports. The bot reads **visible clock labels and the player state**, clicks the iframe's Play button, observes the real *playing → ended* progression, selects the next synthetic song, and clicks Play again. The acceptance test requires **10 starts, 10 completions, and 9 transitions**.

```bash
npm install
npx playwright install chromium
npm run dj:lab
# On a desktop with a graphical display:
npm run dj:lab:headed
npm run dj:lab:unit
```

This is a proof of browser automation, **not evidence that the official Suno iframe supports automated operation or that GitHub Pages can do this**. Playwright is a local desktop process, not a feature installed in listeners' browsers. The code has no configurable target URL and no Suno access, credentials, downloads, or control bypass.

Timer-based inference is deliberately conservative: a countdown reaching the duration is **not** enough to advance if the player is paused or buffering. The controlled iframe also exposes a separate *ended* state, and the bot requires having observed *playing* before accepting it. For a real external embed, missing observability and gesture/autoplay restrictions remain unresolved. A production continuous radio system should use music files hosted under the artist's control, with normal HTML audio `ended` events.

## InfinityLens369 guest stage (rung 7)

Visual Lab now offers a dedicated opt-in **InfinityLens369 guest stage**, showing the maintained MIT-licensed fractal visualizer from [the original project](https://github.com/MichaelWave369/infinitylens369). The stage opens the published `https://michaelwave369.github.io/infinitylens369/` experience in an isolated browser iframe. Nothing loads until the listener selects **Launch InfinityLens stage**. **Stop visual stage** unmounts it, releasing WebGL resources; the built-in visual modes remain available separately.

The guest stage retains the original application's shaders, visual controls, presets, comfort options and update cadence without shipping a second copy of its 27 KB+ shader module in MoreBounceLabs. It can open separately or fullscreen if the browser permits. On browsers with reduced-motion preference, launch is unavailable to prevent surprises. An explicit original-site link is always provided if a browser blocks embedding.

**Audio boundary:** a Suno iframe and an InfinityLens iframe cannot directly share waveform/audio analyser state. This integration makes ambient visual effects available alongside MBL playback, **not Suno-reactive visuals**. To use InfinityLens's own audio analysis, listeners must explicitly provide audio to its player. No autoplay or cross-origin control claims.

## MBL ↔ InfinityLens369 Visual Bridge v1

The **Visual Lab** guest stage now includes local MBL controls for **8 fractal scenes, 4 palettes, Safe mode, and Reset visuals**. It uses a narrow versioned `window.postMessage` protocol to speak with the *real* InfinityLens renderer, not an imitation. It doesn't control the original application's audio interface.

Two independently deployed repositories must have matching versions:
1. Merge [InfinityLens369 receiver PR #1](https://github.com/MichaelWave369/infinitylens369/pull/1) and allow its GitHub Pages deployment to finish.
2. Merge this **MoreBounceLabs host PR**. Visit Visual Lab, Launch InfinityLens stage and wait for **Visual bridge connected**.
3. Use the MBL Scene Controls. If the other app hasn't deployed, the controls stay disabled and a clear **bridge unavailable** notice appears; the original InfinityLens stage remains usable.

**Security/permission boundary:** MBL accepts messages only from the correct iframe window at the exact InfinityLens origin, on the matching protocol/version. InfinityLens validates that commands come only from the trusted MBL embedding parent and permits an explicit four-action allowlist. Neither side receives auth, arbitrary scripts, file data, or direct third-party audio access. The iframe remains isolated. **Suno audio cannot be bridged via this mechanism.** Real audio reactivity requires a separately authorized local/native audio source and an explicit opt-in.

Run `node --experimental-strip-types --test scripts/infinity-bridge.test.mjs` to check the host protocol invariants.

## Decks takeover: Backspin '96 v1.5.0 (PR #9)

The Decks room is now reserved for the **original Backspin '96 dual-AudioWorklet DJ booth**. The old demo two-`<audio>` mixer is removed. The MBL bottom mini-player is hidden in Decks, and entering Decks clears/stops the existing MBL playback so the DJ rig owns the audio.

**One source import is needed to activate the real booth.** The uploaded artist-owned original archive is not automatically accessible to GitHub Actions. Commit that exact Backspin v1.5.0 ZIP, unchanged, to **`vendor/backspin96-source.zip`** on this PR's branch (GitHub: Add file → Upload files). Expected SHA-256:

```
0653316cf3e6a8f331d56089d6d79916b3543497519a4b3fb1d911d06bb5bd6e
```

On GitHub Actions, `python3 scripts/stage-backspin96.py` validates the archive hash and ZIP paths, then copies the original approved runtime to `public/backspin96/`. The GitHub Pages build includes it under `/MoreBounceLabs/backspin96/`. Runtime stage marker `mbl-stage.json` lets the Decks room distinguish an actually published booth from an empty/unavailable source pack. The original engine, worker, scratch timeline and Suno download crate library are **not rewritten**. A clean install can be tested with:

```bash
python3 scripts/stage-backspin96.py
npm run build:pages
npm run verify:pages
```

**Do not merge before committing the original source archive** if you expect the full booth to appear on the public site immediately. Without it, the rest of MBL still deploys safely, and Decks shows an honest source-pack-pending panel instead of pretending to be Backspin.

**Audio and storage boundaries:** Backspin requires a visitor-initiated gesture to initialize its AudioWorklets. Visitors bring their own authorized downloaded audio; Suno embeds are not mixed, captured, or downloaded. Backspin's IndexedDB crate data remains in the browser's origin storage. GitHub Pages does not provide the custom COOP/COEP headers from Backspin's local Python server, so the non-isolated copy transport is used; actual scratching, latency, recording, and long-session reliability **must** be qualified on the deployed site before declaring it production-ready. On Decks exit, the iframe unmounts. For uninterrupted independent DJ sessions, use **Open standalone booth**.

The included original `LICENSE` is staged with the app. Reference source: user-supplied `Backspin96_Library_Reliability_Recovery_Phase6A3_v1.5.0.zip`.

## SoundCloud Archive Shelf (PR #10)

The **Vault** now includes a SoundCloud Archives section with 18 verified public albums from [MicTek's original SoundCloud page](https://soundcloud.com/microneesia/albums), totaling **200 listed album-track placements** as of the 2026-10-07 catalog snapshot. Album links and artwork were verified against their actual public SoundCloud pages. Each album plays via SoundCloud's **official playlist iframe widget**; the original 19 Suno albums and 344 tracks remain intact.

Select an album's cover to open its playlist in the Vault. SoundCloud provides the Play, Pause, seek, and other media controls within its own iframe. While that player is selected, the MBL bottom mini-player is hidden and its native/Suno audio is suspended, preventing two independent playback controls. Closing the official SoundCloud player returns the MBL mini-player.

For optional continuity support, the page loads SoundCloud's [HTML5 Widget API](https://developers.soundcloud.com/docs/api/html5-widget). After a FINISH event, the **Assist next-track playback** option (enabled by default) waits a second for SoundCloud's own playlist auto-advance, then **only if SoundCloud is still paused** tries the documented `next()` and `play()` methods. The help text explicitly warns when autoplay might be blocked by a browser. This is best-effort, not guaranteed radio; it does not skip tracks if SoundCloud is already playing. Cross-*album* continuous radio is not included in this first archive import.

The archive snapshot is manually maintained in `src/data/soundcloud-albums.json`. It includes no SoundCloud API tokens, direct transcoding/stream URLs, downloaded music or audio caching. Public playback availability remains subject to SoundCloud's own restrictions. **Backspin '96** still uses separately imported authorized local audio files and does not capture SoundCloud's playback. User-facing site branding stays MoreBounceLabs or MBL, while historic **MicTek** artist attribution is preserved where it identifies the original recording account.


## SoundCloud Archive Expansion (PR #11)

The SoundCloud Archive Shelf includes eight newly recovered public releases missing from SoundCloud's first ten visible album results: **Boga Beatz V.1, V.2, V.3, V.4, V.5, V.6, V.7**, and the 2022 instrumental album **Reflections**. Each album's published SoundCloud set, artwork and track count were independently checked against its public page. The complete Boga Beatz **V.1–V.9** album sequence is now represented.

**SoundCloud archive now: 18 albums, 200 album-track placements** (not necessarily 200 unique songs). The original Suno catalog remains 19 albums and 344 tracks. This is a manually verified snapshot, **not an exhaustive account export**: SoundCloud's public listing stops after the first ten visible albums, so additional historical releases may still exist. We do not invent a public SoundCloud player for titles seen only on a different distributor. A separate `/sets` collection hosts playlists, not albums; these stay outside the album total.

The archived album pages are played in their official SoundCloud playlist widget with the same transport-hand-off behavior and best-effort next-track assist as PR #10. No tracks, streams, API keys or private downloads are saved by this import.

## Music Timeline: Explore the Eras (PR #12)

The **Timeline** navigation room at `#/timeline` presents MoreBounceLabs' entire currently verified discography as a colorful year-by-year journey. It's a static GitHub Pages view built from two **existing** catalog sources, not a new database or scraper:

- **19 Suno releases (344 tracks)** from `public/catalog/albums.json`
- **18 SoundCloud albums (200 album-track placements)** from `src/data/soundcloud-albums.json`
- **37 releases, 544 track placements, 5 represented years** (2026 through 2022). Some tracks may appear in more than one collection; these figures do **not** claim 544 unique recordings.

Listeners can filter by year, platform (All / SoundCloud archive / Suno releases), and the shared header search. Each year has a lightweight ambient color atmosphere and original cover art. The **release year** is the only chronological precision claimed; album order within a year is deterministic alphabetical, not a claim of exact release dates.

Selecting a **Suno** release opens the MBL album route. Selecting a **SoundCloud** release navigates into the Vault with its official embedded playlist player; MBL's native transport is suspended during that playback, following the PR #10 player handoff. Backspin, radio, Vault, and InfinityLens code are unchanged.

Atmospheric animations respect the browser's **prefers-reduced-motion** setting and do not use microphone access, WebGL, or SoundCloud/Suno audio analysis. A future optional InfinityLens enhancement could select visual scene presets by historical era but would require its own permission-checked bridge rung.

Development tests: `node --experimental-strip-types --test scripts/timeline.test.mjs`. GitHub CI now checks the Timeline route, year grouping, filter correctness, preserved catalog totals and Pages bundle inclusion.
