/**
 * Additive MBL integration installed after the original (SHA-pinned) Backspin
 * app.js module has initialized. The archived source itself is unmodified.
 * No file import, remote fetch, playback bypass or app authority is added.
 *
 * The embed is same-origin and MBL reads the adapter from the parent frame.
 * Scratch calls go to Backspin's existing set-jog/release-jog AudioWorklet API.
 */
window.__MBL_BACKSPIN = Object.freeze({
  version: 1,
  snapshot() {
    return {
      ready: Boolean(system.ready),
      A: {
        loaded: Boolean(system.decks.A.track),
        title: system.decks.A.track?.name || '',
        playing: Boolean(system.decks.A.playing),
      },
      B: {
        loaded: Boolean(system.decks.B.track),
        title: system.decks.B.track?.name || '',
        playing: Boolean(system.decks.B.playing),
      },
      crossfader: Number(system.crossfader || 0),
    };
  },
  scratch(deckId, ratio) {
    if (deckId !== 'A' && deckId !== 'B') return false;
    if (!system.ready || !system.decks[deckId]?.ready || !system.decks[deckId].track) return false;
    if (!Number.isFinite(ratio)) return false;
    system.decks[deckId].setJogRatio(Math.max(-4, Math.min(4, ratio)), 'scratch');
    return true;
  },
  release(deckId) {
    if (deckId !== 'A' && deckId !== 'B') return false;
    if (!system.ready || !system.decks[deckId]?.ready) return false;
    system.decks[deckId].releaseJog('vinyl');
    return true;
  },
});
