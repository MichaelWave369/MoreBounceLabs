/**
 * @param {number} sec
 */
export function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * @param {{ duration?: number }[] | undefined} tracks
 */
export function runtime(tracks) {
  return (tracks || []).reduce((n, t) => n + (Number(t.duration) || 0), 0);
}

/** @typedef {{ albumId: string, index: number, title: string, albumTitle: string }} StationItem */

export const STATIONS = [
  {
    id: "funk",
    name: "Funk Headquarters",
    blurb: "Album titles that say funk or bap. Not a genre tag.",
    /** @param {string} title */
    test: (title) => /funk|bap/i.test(title),
  },
  {
    id: "night",
    name: "Night Drive",
    blurb: "Cruise, altitude, and departure records.",
    /** @param {string} title */
    test: (title) => /cruise|altitude|departure/i.test(title),
  },
  {
    id: "orbit",
    name: "Chill Orbit",
    blurb: "Ocean, dream, and tide records.",
    /** @param {string} title */
    test: (title) => /ocean|dream|tide/i.test(title),
  },
  {
    id: "space",
    name: "Deep Space",
    blurb: "Parallax, gravity, azure, neon, glitch, lucid, architecture.",
    /** @param {string} title */
    test: (title) => /parallax|gravity|azure|neon|glitch|lucid|architect/i.test(title),
  },
  {
    id: "weird",
    name: "Weird Science",
    blurb: "Memetendo, science, nine, and glitch titles.",
    /** @param {string} title */
    test: (title) => /meme|science|nine|glitch/i.test(title),
  },
  {
    id: "all",
    name: "Shuffle Everything",
    blurb: "Every track in the house, shuffled.",
    test: () => true,
  },
];

/** @param {string} id */
export function stationById(id) {
  return STATIONS.find((s) => s.id === id) || STATIONS[STATIONS.length - 1];
}

/**
 * @param {{ id: string, title?: string, tracks?: { title?: string }[] }[]} albums
 * @param {string} id
 * @returns {StationItem[]}
 */
export function collectStation(albums, id) {
  const station = stationById(id);
  /** @type {StationItem[]} */
  const items = [];
  for (const album of albums || []) {
    if (!station.test(album.title || "")) continue;
    (album.tracks || []).forEach((track, index) => {
      items.push({ albumId: album.id, index, title: track.title || "", albumTitle: album.title || "" });
    });
  }
  return items;
}

/** @param {string | undefined} id */
export function safeEmbed(id) {
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return "";
  return `https://suno.com/embed/${id}`;
}

/** @param {string | undefined} url */
export function safeHttps(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

/**
 * Select a single honest playback UI. Existing catalog clip URLs are
 * undocumented Suno/CloudFront endpoints, so prefer the official embed
 * rather than attempting a blocked stream and showing duplicate controls.
 * Artist-hosted HTTPS audio retains the native player.
 * @param {{ src?: string, sunoId?: string } | undefined} track
 * @returns {{ kind: "embed" | "native" | "none", url: string }}
 */
export function playbackSource(track) {
  const direct = safeHttps(track?.src);
  const embed = safeEmbed(track?.sunoId);
  let isSunoClip = false;
  if (direct) {
    const host = new URL(direct).hostname.toLowerCase();
    isSunoClip = host === "d2lwuy8qc234o3.cloudfront.net" || host === "cdn1.suno.ai" || host === "cdn2.suno.ai";
  }
  if (embed && (!direct || isSunoClip)) return { kind: "embed", url: embed };
  if (direct && !isSunoClip) return { kind: "native", url: direct };
  return { kind: "none", url: "" };
}

/** @param {string} hash */
export function parseHash(hash) {
  const parts = String(hash || "")
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);
  // Preserve old shared links after Lounge is retired.
  const room = parts[0] === "lounge" ? "desk" : (parts[0] || "lobby");
  const known = new Set(["lobby", "vault", "timeline", "lab", "radio", "decks", "desk", "album"]);
  if (!known.has(room)) return { room: "lobby", albumId: "", track: "" };
  if (room === "album") return { room, albumId: parts[1] || "", track: parts[2] || "" };
  return { room, albumId: "", track: "" };
}

/**
 * Move one queued item by a relative number of positions while preserving
 * the identity of the active item, even when a neighbor crosses the cursor.
 * Out-of-range requests are no-ops.
 * @template T
 * @param {T[]} queue
 * @param {number} cursor
 * @param {number} from
 * @param {number} dir
 * @returns {{ queue: T[], cursor: number }}
 */
export function reorderQueue(queue, cursor, from, dir) {
  const to = from + dir;
  if (!Number.isInteger(from) || !Number.isInteger(dir) || from < 0 || to < 0 || from >= queue.length || to >= queue.length || to === from) {
    return { queue, cursor };
  }
  const next = queue.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  const active = cursor === from ? to : from < cursor && to >= cursor ? cursor - 1 : from > cursor && to <= cursor ? cursor + 1 : cursor;
  return { queue: next, cursor: active };
}

/**
 * Resolve a share URL's zero-based track index (the original format).
 * Never autoplay based on a URL alone.
 * @param {string} raw
 * @param {number} count
 * @returns {number | null}
 */
export function sharedTrackIndex(raw, count) {
  if (!/^(0|[1-9][0-9]*)$/.test(String(raw ?? ""))) return null;
  const index = Number(raw);
  return Number.isSafeInteger(index) && Number.isInteger(count) && index >= 0 && index < count ? index : null;
}

/**
 * @template T
 * @param {T[]} list
 * @returns {T[]}
 */
export function shuffleIds(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
