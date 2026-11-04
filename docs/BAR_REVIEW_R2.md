# Bar Review R2: A/B auditions, keeper and review notes

## Changes

The original **Writers → Freestyle Dojo → Bar Review Sampler** remains a short-form, browser-local recorder. R2 turns saved samples into a review workspace:

- **A/B Bar Audition**: Select two different *recorded* samples from the current lyric page. Press **Listen to A** and **Listen to B** to alternate between attempts using one shared audio player. This does not play both recordings simultaneously, perform time alignment, or generate automatic scores.
- **Per-take notes**: Write up to 600 characters about cadence, breathing, punchlines and delivery.
- **Artist rating**: Select Unrated or your own 1–5 rating. These are user judgments, not algorithmic evaluations.
- **Keeper**: Select one take to mark as the preferred version for the lyric page. Saving a new keeper atomically clears the old keeper's flag, without deleting its recording, notes or rating. Text-only snapshots can also be reviewed.
- **Review sheet**: Export a plain-text sheet of saved bar text, timestamps, rating, notes and keeper flags. The review sheet contains **no audio bytes**. Export actual takes using each recording's separate Export control.

## Data and backward compatibility

Metadata is added as optional fields on the existing IndexedDB `bar-samples` objects. Existing samples without notes or ratings load as Unrated, no notes, not keeper. The same IndexedDB v2 schema is retained and no migration recreates or removes either the `clips` or `bar-samples` store.

Reviews are saved only when the user presses **Save review** on the relevant take. Pending text is not automatically saved; navigate away only after saving. If storage is blocked or full, the UI reports failure. No request uploads the lyrics, notes or clips.

Full Freestyle Book JSON backup **does not include** these reviews or any audio. Export the review sheet and audio files separately before clearing the browser, switching devices or deleting lyric pages. This is not an encrypted or cloud-synced service.

## Acceptance

1. Pick a Freestyle Book page, record at least two deliveries of one bar. Reload and select A/B using the dropdowns. Press Listen A, then Listen B. The single player should switch audio sources cleanly and never play both at once.
2. Type different notes and ratings, save each review. Mark B as keeper and save. Mark A as keeper and save. Confirm the B keeper flag is cleared but its audio, note and rating remain.
3. Reload and verify the notes, ratings and keeper persist. Use Export review sheet and inspect the text file. Verify it contains no audio and download the takes individually.
4. Select another lyric page and confirm its review state is independent. Return to the previous page; A/B dropdowns reset and stored reviews are still available.
5. Verify old bar samples, existing full-length Dojo recordings, 26 Suno albums and SoundCloud archive are unchanged. Denied microphone permissions must not prevent editing saved reviews.

### CI

```bash
node --experimental-strip-types --test scripts/bar-review-r2.test.mjs scripts/bar-sampler.test.mjs scripts/freestyle-dojo.test.mjs
npm run typecheck
npm run build:pages
npm run verify:pages
```
