/**
 * Pure matching and transport decisions for consent-based local continuous
 * radio. No Suno/SoundCloud streams or undoc. provider URLs are involved.
 */
/** @typedef {{name:string,size:number,type?:string}} LocalRadioFile */
/** @typedef {{albumId:string,index:number,title:string,albumTitle:string}} RadioCatalogTrack */
export const MAX_RADIO_FILES = 500;
export const MAX_RADIO_FILE_BYTES = 250 * 1024 * 1024;

/** @param {string} text */
export function radioName(text) {
  return String(text || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.(mp3|wav|ogg|opus|flac|m4a|aac|mp4|webm)$/i, "")
    .replace(/^\s*(?:\d{1,3}\s*[-._)]\s*)+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^\s*(?:\d{1,3}\s+)+/, "")
    .replace(/\s+/g, " ").trim();
}

/** @param {LocalRadioFile} file */
export function acceptableRadioFile(file) {
  if (!file || typeof file.name !== "string" || !file.name.trim() ||
      !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_RADIO_FILE_BYTES) return false;
  return /^audio\//.test(file.type || "") ||
    /\.(mp3|wav|ogg|opus|flac|m4a|aac|webm)$/i.test(file.name);
}

/**
 * Conservatively map selected local files onto the known verified station
 * song titles. Ambiguous titles are never silently paired with wrong audio.
 * @param {LocalRadioFile[]} files
 * @param {RadioCatalogTrack[]} station
 */
export function matchRadioFiles(files, station) {
  const used = new Set();
  const assignments = [];
  for (const item of station) {
    const title = radioName(item.title);
    const album = radioName(item.albumTitle);
    if (!title || title.length < 4) continue;
    const candidates = [];
    for (let i = 0; i < files.length; i++) {
      if (used.has(i) || !acceptableRadioFile(files[i])) continue;
      const name = radioName(files[i].name);
      const exact = name === title;
      const boundary = title.length >= 6 && (" " + name + " ").includes(" " + title + " ");
      if (!exact && !boundary) continue;
      const withAlbum = album && (" " + name + " ").includes(" " + album + " ");
      candidates.push({ index: i, score: exact ? 3 : withAlbum ? 2 : 1 });
    }
    if (!candidates.length) continue;
    candidates.sort((a, b) => b.score - a.score);
    // If we cannot distinguish between identical title matches, don't guess.
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) continue;
    const chosen = candidates[0].index;
    used.add(chosen);
    assignments.push({ fileIndex: chosen, title: item.title, albumTitle: item.albumTitle });
  }
  return assignments;
}

/**
 * @param {number} index
 * @param {number} length
 * @param {boolean} repeat
 * @param {boolean} shuffle
 * @param {()=>number} [random]
 */
export function nextRadioIndex(index, length, repeat, shuffle, random = Math.random) {
  if (!Number.isInteger(index) || length <= 0 || index < 0 || index >= length) return -1;
  if (length === 1) return repeat ? 0 : -1;
  if (shuffle) {
    const raw = Number(random());
    const step = Math.max(0, Math.min(length - 2, Math.floor((Number.isFinite(raw) ? raw : 0) * (length - 1))));
    return (index + step + 1) % length;
  }
  if (index === length - 1) return repeat ? 0 : -1;
  return index + 1;
}
