# BackSpin96 R5: Set Ledger

Set Ledger is an **opt-in, read-only mix timeline** inside the standalone DJ booth.
It neither replaces nor modifies the pinned BackSpin96 v1.5.0 audio engine.

## Usage
1. Open `/MoreBounceLabs/backspin.html` and expand **Set Ledger · Private Mix Timeline**.
2. Optionally check **Include track names** *before* beginning. The default is off.
3. Click **Start set ledger**. No data is logged before that user gesture.
4. Load and play tracks normally. The ledger compares existing adapter snapshots
   approximately every 650 ms to detect deck loads, unloads, play/pause transitions,
   engine initialization and crossfader changes between A, center and B regions.
5. Add manual **Transition**, **Highlight** or **Note** markers if useful.
6. Click **Stop monitoring** when finished. Click **Export JSON** and store the
   downloaded report yourself. You can resume after pausing, or clear the log
   (with a confirmation) and begin a fresh session.

## Provenance and fidelity
- `OBSERVED` means a change was inferred by comparing periodic bridge snapshots.
  This is **not** evidence of audible output, accurate cue timing or sound quality.
  Events occurring between polls can be missed.
- `MANUAL` means the operator explicitly started/stopped monitoring or placed
  a marker. Notes may contain anything the user chooses to type.
- Log times use wall-clock timestamps plus seconds elapsed since monitoring started.
  They are **not** sample-accurate or beat-aligned.
- A maximum of 1,000 recent events are retained in memory. Old entries fall off
  the buffer when the cap is exceeded; export periodically for longer DJ sets.

## Privacy and lifecycle
- Logging is *off* by default and stays off until Start is clicked.
- The ledger does not access microphones, media files, recordings, credentials,
  browser file handles, external streams or output devices.
- Track titles are excluded by default; opting in allows the bridge-reported
  title (which may include local filenames) into this session's log and export.
- State exists only in browser component memory, not localStorage or a backend.
  View switching does not reset it. Explicit rig reload, navigation, tab closure
  and lost browser state discard unsaved entries.
- `Export JSON` creates a local Blob download on deliberate user action. It
  does not send reports to MoreBounceLabs or another server.

## Verification
CI runs `node --test scripts/backspin-set-ledger.test.mjs` alongside the R3/R4 tests,
typecheck, Pages build and static asset verification.

Perform a real DJ test: start monitoring; load A and B; play and pause each;
sweep the crossfader; add a marker; verify the observed/manual provenance labels,
and export the JSON. Leave the title option off and confirm filenames don't
appear. Switch through all three workspace views and confirm live playback
and timeline persist. Reload the rig intentionally and verify the ledger resets.
