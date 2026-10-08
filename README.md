# More Bounce Labs / MicTek House

A local-first music house for **Mikey More Bounce / MicTek**, with an album vault, listening lounge, visual lab, radio stations, two DJ decks, browser-local favorites and playlists, and a persistent player.

## Catalog integrity

The committed catalog lives at `public/catalog/albums.json`: **19 albums and 344 tracks** at the October 2026 import baseline. Its existing titles, Suno IDs, source references, artwork, and album ordering must be preserved unless the artist explicitly edits the catalog. The baseline is enforced by `scripts/house-logic.test.mjs`.

The app references remote Suno media and embeds. **A track in the catalog is not proof that playback is available to every visitor.** Direct streaming depends on the remote host and browser restrictions; official Suno embed fallback is available in the main player. Do not bypass access controls or treat undocumented clip links as a permanent distribution contract. For long-term independence, prefer properly licensed, artist-controlled audio hosting.

## Run locally

Requires Node.js 22 and npm:

```bash
npm install
npm run dev
```

The exported lockfile currently fails a clean `npm ci` because some transitive dependencies are out of sync. `npm install` reconciles those versions during installation; a future cleanup should commit a refreshed lockfile so CI can return to strict `npm ci`.

The development server listens at `http://localhost:8080`.

## Checks

```bash
npm run typecheck
node --test scripts/house-logic.test.mjs
npm run lint
npm run build
```

The inherited Grok platform test suite (`npm test`) currently includes PWA identity tests that fail against this branded export (8 failures observed on the initial GitHub Actions run). This first-flight CI checks the music-house regression tests separately; the full inherited suite still needs an isolated-fixture cleanup before it should become a required gate.

The build currently uses **TanStack Start + Nitro with a Vercel preset** (see `vite.config.ts`). A push to this GitHub repository does **not** automatically publish a working GitHub Pages deployment. Deploy this build to a compatible host such as Vercel, or deliberately convert it to a static SPA before enabling GitHub Pages. The older `mictek-house` Pages site is separate and should not be overwritten without a tested migration.

## Rooms

- **Lobby:** featured releases and entry points.
- **Vault:** album gallery, search, sort, and viewing styles.
- **Lounge:** queue, Now Playing, sleep timer, visualizer.
- **Lab:** ten visualizer modes, with ambient fallback if audio analysis is unavailable.
- **Radio:** automatically assembled stations based on album titles, not invented genre labels.
- **Decks:** two separate audio elements and a volume crossfader. No beatmatching claim.
- **Desk:** browser-local favorites, playlists, history, and catalog export.

## First-flight stability improvements

- Both DJ decks bind their selected album's first authorized HTTPS track at initial render and on selection changes. The listener no longer has to switch away from an album to load it.
- Queue movements preserve the identity of the active track when an adjacent item crosses the playing cursor. Regression tests cover each direction and invalid indices.
- Desk instructions refer to this repository instead of the original Pages repository.

## Next recommended milestones

1. Verify playback and official embed fallback on a real desktop and mobile browser.
2. Confirm intended hosting and public URL; build deployment validation around that target.
3. Improve media error handling and playback recovery with source-level integration tests.
4. Add track deep-link behavior and accessible mobile player testing.
5. Expand the DJ deck only after its audio-source limitations are understood.

## Shareable song links

Song URLs like `#/album/trunk-funk/3` now select and highlight the fourth song (the existing URL convention is **zero-based**) with a **Play this song** action. These links do not autoplay, because browsers often block media without a direct tap. Invalid or out-of-bounds indexes show a friendly message, leaving the rest of the album usable. Album-only links still open normally.

Hash routing is compatible with simple static navigation but does not create individually server-rendered track previews for social-media crawlers.

## GitHub Pages (static React build)

This repo includes a separate static build so GitHub Pages does not need TanStack Start, Nitro, Vercel, PGLite, or a server.

- **Expected public URL after deployment:** https://michaelwave369.github.io/MoreBounceLabs/
- **Run locally:** `npm install` then `npm run build:pages`
- **Verify:** `npm run verify:pages`
- **Output folder:** `dist-pages/`
- **CI:** Pull requests verify both the existing server-oriented build and the static Pages build.
- **Publish:** Merge the Pages deployment PR to `main`. GitHub Actions runs `.github/workflows/pages.yml`, uploads the static build and deploys it with `actions/deploy-pages`.

**Important GitHub setting:** Under **Settings → Pages → Build and deployment**, choose **Source: GitHub Actions**. If Pages has never been enabled, this one-time repository setting may be required before the deploy job succeeds. No repository secrets or paid hosting are needed.

This is a **second deployment target**. The original `mictek-house` GitHub Pages site remains unchanged, and this build does not attempt to host a server-side auth/database backend. Hash routes like `#/album/trunk-funk/3` remain on the same static `index.html` path and are safe to refresh. The catalog request uses Vite's base URL, so it resolves to `/MoreBounceLabs/catalog/albums.json` on Pages, not the domain root. It is still subject to Suno/media-host playback rules and browser restrictions.
