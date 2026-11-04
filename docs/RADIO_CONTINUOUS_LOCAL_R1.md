# Continuous Radio R1: artist-selected audio

## Why Suno does not currently auto-advance inside MBL

The existing RadioConsole stations are metadata-backed collections of public Suno song IDs. Each selection mounts Suno's official cross-origin song iframe. That iframe doesn't expose a documented, reliable `ended` event and `next/play` API to our parent app. Clicking MBL's **Next** loads another player, but pressing **Play** inside Suno remains necessary. We do **not** scrape Suno CDN streams, inject into iframe internals, invent song lengths, or promise cross-origin autoplay.

## The workable continuity lane

**Radio → Continuous Radio · Local Audio** accepts multiple music/audio files or a local music folder, selected by the listener. Files stay in browser memory for the current visit. **Play continuous radio** starts a real HTML5 `<audio>` playback session; its `ended` event advances to the next local file automatically, including repeat-all at playlist end when enabled. A single user gesture starts playback. Browser codec or autoplay restrictions can still require another manual gesture and are reported.

Listeners may use **All locally selected files** (immediate playlist) or **Current station title matches** (conservative mapping to verified MBL Suno track titles by filename). Ambiguous matches are skipped. This mode does not magically grant access to streams for catalog tracks that have no authorized local file.

Local mode controls: Play/Pause, Next, Previous, Stop, Shuffle, and Repeat all, available both on the section and through existing radio console hotspots while local playback owns the audio. Tuning a Suno station stops local playback, and starting local playback suspends the other house transport. The MBL mini-player is hidden while local radio is active so listeners don't get competing audio controls.

## Privacy and rights

- No upload, network POST, live proxy, background capture, audio download, provider token, or IndexedDB copy is made.
- A browser `blob:` object URL references only a File the visitor explicitly selected; revoked on track transition, stop, or navigation.
- At most 500 selected audio files are retained in the page session; individual files larger than 250 MiB are skipped. Browser decoding support varies.
- Local files are **not persisted**. A reload or leaving Radio requires selecting them again. This avoids silently consuming device storage with an artist's entire audio collection.
- The five existing official Suno curated station programs and all catalog links remain available, but Suno embeds themselves are still manual.
- Users should select only recordings they own or are authorized to play. This does not authorize ripping Suno or SoundCloud audio.

## Acceptance

```bash
node --test scripts/radio-local.test.mjs scripts/lobby-radio-auto-albums.test.mjs
npm run typecheck
npm run build:pages
npm run verify:pages
```

Manual browser checks: select three owned MP3 files, press Play once and listen past a track boundary. Verify next auto-starts. Toggle Repeat all and verify wrap-around after the final track. Check Shuffle avoids immediate repeats, pause/resume, previous, next, stop, and changing files. Try a folder on Chromium desktop; ensure no upload. Toggle current-station title matching and verify only supported names are queued, with ambiguous titles skipped. Tune Suno, check local stops and the official iframe mounts. Navigate away from Radio and verify no local audio remains. Confirm blocked autoplay and unsupported codec errors are presented instead of reported as success.

## Future extension

For truly unattended public radio streaming of *all* Suno releases without local file selection, we need an authorized, hostable audio library with the artist's distribution rights and a CDN/streaming backend that supports controlled queues. That is a separate licensing/deployment project, not solved by a cross-origin embed.
