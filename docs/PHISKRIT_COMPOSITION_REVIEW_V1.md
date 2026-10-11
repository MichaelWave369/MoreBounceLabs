# PhiSkrit → More Bounce Labs: read-only composition review v1

## Why this is a separate workspace

More Bounce Labs Agent Mix Studio imports `mbl-mix-v1` documents. Those documents are **listening-set proposals** referring to verified album IDs and song indexes from MBL's published catalog. They are not MIDI note arrangements and do not give permission to play without a user's action.

PhiSkrit Composer v0.5 exports **`phiskrit.rhythm.composition.v1`**, a standalone instrument-neutral *modern* syllabic note arrangement. A composition does not contain or imply any MBL album identities.

To preserve both contracts, MBL offers **Desk → PhiSkrit Review**, a read-only local composition inspector rather than extending or weakening the existing Mix Exchange parser.

## User workflow

1. Open [PhiSkrit](https://michaelwave369.github.io/PhiSkrit/), choose **Composer**, and export **Composition JSON**.
2. Open [More Bounce Labs](https://michaelwave369.github.io/MoreBounceLabs/), then **Desk → PhiSkrit Review**.
3. Select the downloaded JSON file.
4. If validation passes, review title, BPM, clip repetitions, reconstructed note timing, heavy/light counts, beats and estimated duration.

Neither import nor review triggers audio, edits the DJ decks, builds a queue, overwrites a playlist, or saves data to MBL's catalog. Each file stays in the current browser session.

## Independent validator

The receiver is separately implemented in `src/lib/phiskritCompositionReview.ts`; it does not import PhiSkrit source or call external sites. It reconstructs the documented canonical v1 object solely from the user-supplied title, tempo and ordered clips, then structurally compares **every field** of the uploaded object to the reconstruction. Object property order is irrelevant; missing or extra fields, changed note timings, note velocities, incorrect metadata and incorrect repeat counts are rejected.

Frozen v1 constraints:

- Exact schema and interpretation strings.
- Title 1–80 characters, printable; tempo integer 40–200 BPM.
- 1–8 clips, each 1–8 uppercase `L`/`G` positions, repeat count 1–4.
- Maximum 128 derived note events.
- 480 ticks per beat; L = 480 ticks, MIDI note 67, velocity 78; G = 960 ticks, MIDI note 60, velocity 108.
- File import bound at 96 KiB.
- No executable fields, remote audio locations, arbitrary instrument plugins or code evaluation.

**Important:** A structural PASS is not an identity proof, signature, cryptographic verification, musical authorization, or confirmation of historical claims. It only shows agreement with the frozen PhiSkrit v1 data contract.

## Verification

The golden fixture in `scripts/phiskrit-composition-review.test.mjs` is specified independently from PhiSkrit's v0.5 output example (two LGL clips followed by GGLL). It tests exact start ticks, repeated sections, duration, canonical import, and tampered or malformed files. A static isolation guard also checks that the review component and validator do not depend on MBL's existing playback or mix functions.

Run:

```bash
node --experimental-strip-types --test scripts/phiskrit-composition-review.test.mjs
```

This test is part of the CI and GitHub Pages validation workflows.

## Non-goals

- No playback engine, Web Audio, DJ deck commands, queue changes, or automatic transfers.
- No new credential or data permissions.
- No `mbl-mix-v1` substitution, fake Suno tracks or unreviewed catalog editing.
- No claim that laghu/guru note mapping is historical practice.
