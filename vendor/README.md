# Backspin '96 approved source archive

Place the **unchanged** original user-supplied ZIP here with exactly this filename:

`vendor/backspin96-source.zip`

Original local filename: `Backspin96_Library_Reliability_Recovery_Phase6A3_v1.5.0.zip`

Pinned SHA-256:
`0653316cf3e6a8f331d56089d6d79916b3543497519a4b3fb1d911d06bb5bd6e`

This repo's `scripts/stage-backspin96.py` checks the exact digest, validates runtime paths, copies the original MIT-licensed static performance booth into `public/backspin96/`, and includes it in GitHub Pages output. No source code is rewritten during import. Unrecognized/mutated archives cannot be staged.

The archive is not required for the base MBL build; Decks will display an honest pending-source state until it is committed. If the source ZIP is uploaded to this PR branch before merging, GitHub Actions stages and verifies the real booth as part of the PR's Pages build. This is the preferred sequence.

Never commit downloaded Suno MP3/WAV files or private recordings into this directory. DJ audio remains a visitor's own locally imported, authorized files in browser storage.
