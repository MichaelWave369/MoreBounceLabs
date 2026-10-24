# BackSpin96 R4: Preflight Soundcheck

This feature adds an **opt-in, session-only soundcheck** to the standalone DJ booth.
It doesn't replace, fork, play, control or record from the pinned audio engine.

## What is observed automatically?
The browser reports a secure context and the presence of AudioContext/AudioWorkletNode.
The standalone booth already checks the pinned BackSpin96 runtime manifest, and the
existing same-origin bridge reports whether it is connected, whether dual audio was
started, and whether each deck has a loaded track.

These are **software observations, not hardware verification**. A deck reporting
"loaded" or "playing" cannot prove it is audible.

## What must the DJ test?
Use your own authorized local audio files to verify:
1. Deck A through the intended output.
2. Deck B independently.
3. Crossfader A/center/B routing while listening.
4. Headphone cue monitoring.
5. Location of emergency stop, volume and physical output controls.

Every check is explicitly self-attested. Missing checkmarks stay incomplete.
The UI does not automatically mark sound heard or claim a real-world pass.

## Reset, privacy and continuity
- Manual checkmarks live **only in React memory** for the current loaded rig.
- Reloading the rig resets the soundcheck because the component is keyed to the
  explicit rig reset. Changing Vinyl Stage/Mix Console/Full Studio does not reset it.
- Nothing is written to server storage or localStorage.
- The Copy Report action copies a dated text summary of observed states and manual
  checkboxes to the local clipboard on explicit action only, never automatically.
- No music file names, track titles, device identities or recordings are copied.
- The original audio engine remains mounted and handles all Web Audio interactions.

## Verification
Run `node --test scripts/backspin-preflight.test.mjs scripts/backspin-workspace.test.mjs`,
`npm run typecheck`, `npm run build:pages`, and `npm run verify:pages`.

Manual acceptance: load two local tracks, start audio, expand Soundcheck and confirm
the observed statuses. Test output, cue monitoring and crossfader. Complete all manual
checks and verify the status is **Operator marked complete**. Switch all three
performance workspaces while playback is active, confirm the soundcheck remains
selected and audio continues uninterrupted. Confirm **Reload rig** clears manual
checkmarks after a confirmed reset. Repeat with one missing output and keep that
check unchecked: status must remain incomplete.

Browser support and engine status do not measure latency, clipping, loudspeaker
output or headphone signal. The DJ must do those tests physically.
