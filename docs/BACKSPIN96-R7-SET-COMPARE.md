# BackSpin96 R7: Set Compare

R7 extends the standalone booth's read-only R6 Set Review. It adds a private
comparison of two Set Ledger histories without touching BackSpin96's pinned
v1.5.0 audio engine.

## How to compare
1. Open **Set Ledger → Set Review** in the standalone BackSpin96 booth.
2. Set **Set A** by selecting **Current set**, or use R6 **Review saved JSON**
   to import one previously exported R5 ledger.
3. Expand **Set Compare · R7**, and click **Load Set B JSON**.
4. Choose a different saved R5 Set Ledger JSON file. Import uses the same
   strict local validator as R6 (512 KiB limit, 1,000 events maximum).
5. Compare fixed event counts for manually marked transitions/highlights,
   observed fader-zone changes, deck loads, and playback starts.
6. Use **Export comparison CSV** to download the seven fixed metric rows.
   No titles, marker details, local file names or personal notes are included.
7. Choose **Forget Set B** to discard the second file from memory.

Set A can be either a live R5 timeline or a file previously imported into R6.
Set B is always an explicitly chosen local JSON file. Both may change
independently. Neither is uploaded to a remote service.

## Reading the comparison
- The delta column means **Set B count minus Set A count**. It is not a
  performance improvement score.
- Five per-set bars show event counts in **relative elapsed-time fifths**.
  They are not a waveform, beat grid, aligned musical passage, or shared clock.
- Each set's elapsed duration is the **last logged event timestamp**, not the
  full duration of music physically heard.
- Crossfader region transitions and playback are **observed by polling**,
  so events between polls may be missed; manual markers reflect the
  operator's note-taking habits.
- Counts are not normalized for set duration and should not be used to
  rank DJs or infer crowd response, sound quality, beat matching or skill.
- Imported OBSERVED provenance is a **claim in an imported file**; the
  importer cannot independently verify it.

## Safety and privacy
R7 is presentation + pure computation. It never calls Web Audio, changes
playback, reads microphones, captures music, accesses another site, persists
to localStorage or uploads files. A deliberate CSV download is the only export.

It leaves R5 JSON and R6 CSV behavior unchanged. Switching the R3 workspace
should not restart or remount the original audio engine.

## Release verification
- Typecheck and all R3–R7 Node policy tests.
- Stage the checksum-pinned BackSpin runtime; build and verify the Pages app.
- Full MoreBounceLabs regression plus DJ Bot browser smoke.
- Browser hands-on test: import two different R5 exports, swap current/imported
  Set A, verify counts and charts, export comparison CSV, forget Set B,
  and keep two tracks playing while exploring all three DJ layouts.
