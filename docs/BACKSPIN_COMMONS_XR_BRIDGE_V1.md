# Backspin '96 ↔ Infinite Commons XR · governed control bridge v1

This is an **additive control adapter** over the original Backspin v1.5.0 engine in MoreBounceLabs. The SHA-pinned original archive, AudioWorklet, scratch timeline, crate import, recording and existing standalone Decks interface remain untouched.

## Capability
The existing BackspinDecks component listens for a tightly bounded `postMessage` protocol only when mounted as the **same-origin iframe** from `/Infinite-Commons/`.

- Channel: `phi.commons.backspin-xr.v1`
- Version: `1`
- Incoming: `hello`, `snapshot`, `play`, `cue`, `scratch`, `release`, `crossfade`
- All commands are validated in `scripts/commons-xr-protocol.mjs`.
- Scratch ratios are finite and within [-4, 4]; crossfader values within [-1, 1]. Deck must be A or B. Unknown commands and keys are ignored.
- The bridge accepts only `event.source === window.parent`, exact same origin, and parent path beginning `/Infinite-Commons/`.
- **Every new page session defaults to denied**. The DJ has to check **Allow Infinite Commons XR controls in this session**, start Backspin's original dual audio via a physical user action, and load authorized local music as before.
- Leaving the page or unchecking the box withdraws the capability immediately. No authorization persists.

The command receiver uses the existing iframe runtime's `__MBL_BACKSPIN` for snapshots/scratch/release, and the original DOM controls for play/cue/crossfader. It does not expose arbitrary selectors or script execution.

## No new authority
No local file import, autoplay unlock, recording, downloads, unattended agent DJ capability, microphone, credentials, Suno/SoundCloud extraction, or remote broadcasts are granted. The player retains explicit control over imported content. The parent is within the *same GitHub Pages origin*, so any other application on that origin must still be considered part of the same browser-security trust boundary; this is a narrow user consent mechanism, not isolation from a hostile same-origin application.

This component is only one half of the feature. The matching Infinite Commons PR supplies a Three.js room and optional WebXR input. Install/merge this receiver first, then publish its companion. Production Quest latency and real audio behavior require device testing.

## Validation
```sh
node --test scripts/commons-xr-protocol.test.mjs
npm run typecheck
npm run build:pages
npm run verify:pages
```

In the published Commons room, confirm default denial, explicit consent, A/B Play/Cue, bounded scratch/release and crossfade; turning permission off must stop working immediately. Check a non-Commons parent and a different origin are denied. Verify no audio starts from a message before physical authorization. Do not mark XR validated until a real Quest 3 test succeeds.
