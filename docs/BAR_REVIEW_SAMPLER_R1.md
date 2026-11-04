# Bar Review Sampler and Suno-first Vault

## Vault ordering

The Vault now renders all Suno releases first, respecting the existing As listed, Title and Track count options and grid/list/bin views. The full SoundCloud archive remains below the Suno albums, with its official embed and playback controls unchanged. A search can independently filter either section. No release metadata or song IDs changed.

## Writers → Freestyle Dojo → Bar Review Sampler

- Select a lyric page in **Freestyle Book** first, then open **Freestyle Dojo**.
- Choose a written lyric line (first 60 nonempty written lines offered) or type/paste a new sentence of up to 300 characters.
- **Save written bar** stores a text-only snapshot for later review.
- **Record 12-second take** asks for microphone permission on click, records only that microphone (not the protected Suno iframe, and not the Dojo's loaded beat), and automatically stops after 12 seconds. You can Stop earlier.
- Each recording is a new independent attempt, so you can compare multiple performances of the same bar using Listen, Export, Try again and Delete.
- The browser displays at most 24 samples per lyric page, and audio is limited to 8 MiB per sample. If saving fails, an unsaved sample can be downloaded before navigating away. Changing lyric pages remounts the sampler to prevent sharing state between pages.

## Storage and privacy

The existing `mbl-freestyle-dojo-v1` IndexedDB schema upgrades to version 2. It retains the original `clips` object store without clearing it and creates a separate `bar-samples` store indexed by `pageId`. Text-only snapshots and recorded bar samples live in this new store. No cloud synchronization, automatic upload, or encryption is provided.

Freestyle Book JSON export still contains **only the lyric notebook**, not sample audio or snapshots. Export each valuable recorded bar individually; copy text snapshots as needed. Clearing browser data, deleting the associated lyric page, or switching devices may make saved samples unavailable.

Recording starts only on explicit click on a supported secure browser. The app does not continuously listen to the microphone, and its media stream is stopped when a take ends or the sampler unmounts.

## Acceptance checks

```bash
node --test scripts/bar-sampler.test.mjs scripts/freestyle-dojo.test.mjs scripts/writers-room.test.mjs scripts/writers-flow.test.mjs
npm run typecheck
npm run build:pages
npm run verify:pages
```

Hands-on: verify Suno above SoundCloud for grid, list and record-bin layouts, as well as with searches. In the Dojo, save a text bar, record and listen to two versions, export a recording, delete one, reload and confirm persistence. Deny microphone access, test on mobile, and verify that previous long-form Dojo takes still load following the IndexedDB upgrade.
