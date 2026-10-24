# BackSpin96 R6: Set Review

Set Review is a local, read-only analysis surface layered over the R5 Set Ledger.
It does not start or stop audio, remount the DJ engine, or access music files.

## Current session review
1. Open the standalone booth, begin R5 **Set Ledger** monitoring and perform normally.
2. Open **Set Review · R6** beneath Set Ledger.
3. Select **Current set** for stats and a relative timeline while monitoring continues.
4. Filter by observed state changes, manual annotations, declared transition
   events, or track-load events.
5. Use **Export filtered CSV** to save the currently displayed subset.

The R5 JSON export remains unchanged and is the canonical full-fidelity
record for later analysis. The R6 CSV is an *additional view*, not a replacement.

## Review a saved set
1. In Set Review choose **Review saved JSON**.
2. Choose a local JSON export from R5 (format
   `backspin96-set-ledger-v1`). The file is read in the browser only.
3. Switch between **Imported set** and **Current set** to compare the summaries.
4. Use **Forget imported set** to discard the imported analysis state.

The importer accepts a maximum 512 KiB file with up to 1,000 events,
requires ISO timestamps, unique positive integer IDs, valid duration values,
known event kinds and `OBSERVED` or `MANUAL` labels. It ignores all unknown
file properties and rejects malformed data. The imported file is **untrusted
self-reported data**. Its provenance labels have not been independently
verified by BackSpin96.

## Report semantics
- **Marked transitions** count `MANUAL transition` notes. They do *not* count
  every actual musical transition.
- **Fader regions** count `OBSERVED crossfader-zone` changes inferred from
  sampled snapshots (A / center / B). Rapid cuts may be missed.
- **Deck loads** and **play observations** reflect bridge-status changes,
  not confirmed sound through outputs or headphones.
- **Last logged point** is the largest event's elapsed timestamp, not
  the actual length of audio heard.
- Timeline lines are approximate, with up to 150 selected marks shown;
  list view shows the most recent 60 matching events.
- CSV includes the selected events only, quoting all fields and protecting
  values that could execute spreadsheet formulas.

## Privacy
- No audio files, clips, recordings, microphones, streams or output-device
  identities are accessed or transferred.
- Titles are absent when the R5 ledger was exported with title inclusion off.
  Titles or personal notes in a deliberately imported ledger *will be
  visible in its review and deliberate CSV export*. Review your CSV before
  sharing it.
- The imported review lives in component memory, not browser persistence,
  a hosted database or a server. It disappears with a rig reload or tab close.
- R6 can never authenticate imported event claims. Use R5's original export
  plus real recordings if strict timestamp verification is needed.

## QA
Run `node --test scripts/backspin-set-review.test.mjs`,
`npm run typecheck`, `npm run build:pages`, and
`npm run verify:pages`.

In a real browser, import a legitimate R5 export, switch filters, export CSV,
and check spreadsheet escaping with a note beginning with `=`.
Leave music playing during review and switch all three performance workspaces.
Confirm no audio interruption, file upload or hidden network request occurs.
