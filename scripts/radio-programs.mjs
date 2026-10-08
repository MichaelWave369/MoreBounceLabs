/**
 * Real catalog-backed radio programmes for the five buttons on the original
 * console artwork. Every preset contains verified MBL songs (official Suno
 * widgets), not invented RF broadcasts or downloadable music.
 */
/** @typedef {{id:string,title:string,band:"AM"|"FM"|"SAT",hz:number,caption:string,albumIds:string[]}} RadioProgram */
/** @typedef {{id:string,title:string,tracks?: {title?:string}[]}} RadioAlbum */
/** @type {RadioProgram[]} */
export const RADIO_PROGRAMS = [
  { id: "solar", title: "Solar Bounce FM", band: "FM", hz: 104.3,
    caption: "Golden funk, big bass and sunlight on the dancefloor.",
    albumIds: ["trunk-funk", "funktendo-369", "neon-afterglow-society", "bap-science-fundamentals"] },
  { id: "trucker", title: "Night Trucker", band: "FM", hz: 92.6,
    caption: "Neon highways, late-night cruising and midnight coastlines.",
    albumIds: ["anti-gravity-protocol", "lucid-altitude", "cruising-altitude", "the-azure-inheritance"] },
  { id: "porch", title: "Porch Static", band: "FM", hz: 98.1,
    caption: "Oddball experiments, glitch loops and free-range strange.",
    albumIds: ["memetendo-5000", "glitch-remix", "nine-2tha-0", "architectural-intuition"] },
  { id: "desert", title: "Deep Desert AM", band: "AM", hz: 88.4,
    caption: "Long desert drives and transmissions from the deep field.",
    albumIds: ["parallax-nx-98971", "parallax-nx-98971-funk-mode-engaged", "contact-integration-cycle", "departure-cruise-cycle"] },
  { id: "orbit", title: "Orbit Lounge", band: "SAT", hz: 107.7,
    caption: "Ocean tides, dreamy altitude and warm last-light landings.",
    albumIds: ["the-ocean-has-an-alibi", "the-dreaming-tide", "the-azure-inheritance", "cruise-departure-cycle"] },
];
/**
 * @param {RadioAlbum[]} albums
 * @param {string} stationId
 * @param {number} [maximum]
 * @returns {{albumId:string,index:number,title:string,albumTitle:string}[]}
 */
export function buildRadioProgram(albums, stationId, maximum = 48) {
  const preset = RADIO_PROGRAMS.find((p) => p.id === stationId);
  if (!preset) return [];
  const rows = preset.albumIds.map((id) => albums.find((a) => a.id === id)).filter(Boolean);
  const items = [];
  // Round robin between curated albums so a button doesn't simply play all
  // 54 Trunk Funk songs before ever reaching the rest of its channel.
  for (let songIndex = 0; songIndex < 200 && items.length < maximum; songIndex++) {
    let found = false;
    for (const album of rows) {
      const track = album.tracks?.[songIndex];
      if (!track) continue;
      items.push({ albumId: album.id, index: songIndex, title: track.title || "", albumTitle: album.title || "" });
      found = true;
      if (items.length >= maximum) break;
    }
    if (!found) break;
  }
  return items;
}
/**
 * @param {RadioProgram[]} programs
 * @param {"AM"|"FM"|"SAT"|"ALL"} band
 * @param {number[]} counts
 * @returns {number[]}
 */
export function stationBandIndices(programs, band, counts) {
  return programs.map((_, index) => index)
    .filter((index) => (band === "ALL" || programs[index].band === band) && (counts[index] || 0) > 0);
}
