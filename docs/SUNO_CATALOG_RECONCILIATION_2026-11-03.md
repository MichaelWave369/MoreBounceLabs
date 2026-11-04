# Suno catalog reconciliation: November 3, 2026

## Source and approach

Verified against the public [Mikey More Bounce Suno profile](https://suno.com/@michaelwave369) and each official album/song URL. A public profile listing exposed 20 albums; MoreBounceLabs already preserved six older releases not surfaced among those visible profile cards. The union of the existing 19-record archive and seven newly verified releases is 26 albums.

The previous October baseline of 19 Suno albums / 344 track placements is **retained unchanged**. Seven albums are added ahead of it. Each of their 132 entries has an official Suno song UUID and real title, and each album has its original artwork on the official Suno CDN. Playback relies on the existing cross-origin **official Suno iframe**, not guessed CloudFront audio URLs.

## Imported public releases

| Release | Official album | Track placements |
|---|---|---:|
| Bonsai Bap | https://suno.com/album/7f87f5ba-2ab0-491a-ad3f-4e170f717c5d | 18 |
| Head Nod Proof | https://suno.com/album/c870d9f2-0b2c-4eab-81cc-bb0f22f571e1 | 18 |
| Break The Matrix - The Soundtrack | https://suno.com/album/cfd63bd5-7908-4d32-abdf-3e965e4fef7a | 18 |
| G-Funktendo | https://suno.com/album/ab637c8e-fa49-4f74-97d2-25419cfa58b8 | 12 |
| Visions of the Wax | https://suno.com/album/1cdfc5f2-d4e9-42b6-ab85-fd4d07b34077 | 21 |
| RTKO - Rip The Knob Off | https://suno.com/album/5ea13883-b3ec-4da2-9c78-52805a9c7a06 | 24 |
| I-5 Nights | https://suno.com/album/bbea8145-0b71-4a2c-b9c1-019e7b4fe6f8 | 21 |
| **Total newly imported** | | **132** |

## Integrity and limitations

- The resulting catalog contains **26 Suno albums, 476 album-track placements, 467 unique Suno song IDs**. Nine songs on *I-5 Nights* are already featured on previous releases. Those are valid reused album placements, **not nine invented new tracks**, and remain in both albums.
- Album and individual song pages are used only for public metadata. This does not constitute a persistent Suno API, an authorized bulk media downloader, or a promise of uninterrupted third-party playback.
- Original catalog metadata and all older album ordering remain unchanged. The seven new releases appear first in release display order.
- A new future album still needs owner-approved metadata verification. The existing update workflow remains conservative and will not invent track titles, song IDs, or media streams.
- Manual check: open the Vault, each new album, a sample track in its official embed, and the Timeline. Also confirm older albums, playlists, radio, and BackSpin96 remain usable.

## Release gates

```bash
node --test scripts/suno-import-2026-11.test.mjs scripts/house-logic.test.mjs scripts/writers-flow.test.mjs scripts/writers-room.test.mjs
npm run typecheck
npm run build:pages
npm run verify:pages
```
