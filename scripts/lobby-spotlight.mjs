/**
 * Lobby spotlight selection. Avoid showing the same hero album as the last
 * visit when another album is available; never depend on album array order.
 */
/**
 * @param {{id:string}[]} albums
 * @param {string} [previousId]
 * @param {() => number} [random]
 */
export function chooseSpotlightIndex(albums, previousId = "", random = Math.random) {
  if (!Array.isArray(albums) || albums.length === 0) return -1;
  if (albums.length === 1) return 0;
  const choices = albums.map((album, i) => ({ id: album.id, i })).filter((a) => a.id !== previousId);
  const index = Math.min(choices.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * choices.length));
  return choices[index].i;
}
/** @param {number} albumCount @param {number} currentIndex */
export function spotlightNextIndex(albumCount, currentIndex) {
  if (!Number.isInteger(albumCount) || albumCount < 1) return -1;
  return ((currentIndex + 1) % albumCount + albumCount) % albumCount;
}
