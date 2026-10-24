# BackSpin96 R3 Performance Workspace

This release builds on the dedicated standalone DJ page and does not fork, replace,
or modify the original pinned BackSpin96 v1.5.0 engine.

## Views (standalone only)
- **Vinyl Stage:** original giant interactive artwork, plus the compact mixer.
- **Mix Console:** smaller UI without the giant poster; all real deck controls and crossfader stay accessible.
- **Full Studio:** Mix Console plus the complete original rig with crates, waveforms, BPM, MIDI and recording controls.

Switching among these views only changes React/CSS presentation. The engine iframe remains
mounted under the same `key={resetKey}`. It only reloads with an explicit **Reload rig**
action or page reload. The selected view is stored locally on this device, never uploaded.

## Safety during a set
- A browser-native navigation confirmation is requested when either deck reports loaded or
  playing. Browsers can choose not to display the prompt, so save your work before closing.
- **Reload rig** asks for confirmation when either deck reports loaded or playing.
- The new four-point status bar reads the existing adapter snapshot. It does not replace the
  engine's audio controls or claim to measure output volume/audio hardware health.
- **Keep screen awake** is an optional Screen Wake Lock API control. It requires browser
  permission/support, can be released automatically by the OS, and retries after the app
  becomes visible again. It never changes device power settings persistently.

## Acceptance test on a real browser
1. Open `/MoreBounceLabs/backspin.html`, start dual audio and load a local file in each deck.
2. Start playback on one deck and switch Vinyl Stage → Mix Console → Full Studio → Vinyl Stage.
3. Confirm music keeps playing, the crossfader holds its position, loaded tracks remain present
   and the original Full Studio controls are usable.
4. Click **Reload rig**: cancel the confirmation and verify playback remains untouched.
5. Turn on screen wake lock and verify the status; background the tab and return. A blocked
   or released lock must be clearly reported, not represented as guaranteed.
6. Try leave/reload confirmation in your target browser, including installed-app mode.

The build and Node tests validate policy and presentation invariants, not real-time Web Audio
fidelity. Live performance should be validated by an actual DJ using their own local files.
