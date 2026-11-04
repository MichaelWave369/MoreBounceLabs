# Freestyle Dojo R1

## What it does

**Writers → Freestyle Dojo** adds an independent, user-initiated practice booth tied to the selected lyric page. It does not edit any stored lyrics or write album metadata.

1. **Practice**: choose 55–180 BPM, 4/8/16/32 bars, and optional clicks. A Web Audio clock gives a four-beat count-in and then counts up bars and beats. This is a manual BPM clock, **not automatic beat detection**. The recording ends when the selected bar count finishes or you press Stop.
2. **Bring a beat**: optionally choose an audio file from the device (50 MB or smaller). A browser-local blob URL feeds an HTML audio element. The file is not uploaded. If selected and enabled, the local beat is mixed with microphone input into the recording using `MediaStreamAudioDestinationNode`. The click is monitoring only, not captured in the mix.
3. **Record**: requires a secure-context browser with microphone permission, MediaRecorder, Web Audio and local storage support. Live input is **not sent to a server** or monitored through speakers. Use headphones to avoid acoustic bleed. Recording duration is limited by the 32-bar/55-BPM maximum (roughly 144 seconds) and a separate 180-second guard; clips over 32 MiB are rejected.
4. **Save and retrieve**: audio blobs are stored in local IndexedDB keyed by Freestyle Book `page.id`, with a maximum of 12 clips per page. View, replay, export in the browser's supported format (`.webm` or `.m4a`), or delete individual takes. If IndexedDB saving fails while the room is open, the take is held for immediate export.
5. **Long-rhyme pattern map**: extracts written lyric line-end words with three or more *approximate* syllables and highlights repeated two-vowel spelling suffixes. This is **not phonetic rhyme recognition**, multisyllabic prosody measurement, timing analytics or a creativity grade.

## Privacy and backup

- This is browser-local storage, **not encrypted, cloud-synced, or guaranteed to survive clearing browser data**.
- A Freestyle Book **JSON export does not include audio recordings**. Export each clip independently before clearing data, using a new device, or deleting a page. Deleting a lyric page can orphan audio linked to that page ID.
- A selected local backing beat is held in memory as a `blob:` URL, removed on unmount or manual removal. It is never uploaded.
- The Dojo does not use or copy the Suno official embed, streaming endpoints or protected audio. The house player is suspended when local practice starts.
- Browser microphone access is requested only on **Record a take**, not upon opening Writers. Tracks stop on session end, error and component unmount. Leaving the room while a recording is active calls the recorder's stop handler, which attempts a final local save.

## Automated checks

```bash
node --test scripts/freestyle-dojo.test.mjs scripts/writers-flow.test.mjs scripts/writers-room.test.mjs
npm run typecheck
npm run build:pages
npm run verify:pages
```

## Hands-on acceptance tests (desktop and mobile)

1. Create/select a lyric page, open Dojo, set 90 BPM/16 bars and use Start practice. Check four count-in clicks, bar progress and Stop.
2. Choose an artist-owned `.mp3` or `.wav` from the device; verify it plays locally. Start a recording, grant the microphone, speak/rap for a short take, Stop, and confirm local playback and a download file.
3. With headphones, verify the selected beat is present when **Include locally loaded beat** is enabled and absent when disabled. Confirm metronome clicks are not embedded in the take.
4. Reload the page and verify the clip remains linked to the same lyric page; switch to another page and confirm the original page's clip is not displayed.
5. Block microphone permission and confirm the editor, rhymes and timing still work. Block IndexedDB quota and confirm the unsaved take can be exported without losing lyrics.
6. Navigate away mid-recording; the microphone should stop and the take should attempt a final save. Verify no recording continues invisibly.
7. Select new beat files in successive sessions; they must play without silent audio or duplicate playback. Check iOS Safari output format and mic permissions if using an iPhone.
8. Check Backspin96, existing Desk, Suno embeds, 26-album catalog and Pages routing are unaffected.

**Known limits**: a backgrounded/mobile tab may throttle Web Audio scheduling and browser mic recording. Recordings and raw beat audio do not get automatically mixed into published Suno tracks. Seek alignment with a beat file is manual; the practice BPM does not infer its tempo. Browser permissions, codec support and storage limits vary by device.
