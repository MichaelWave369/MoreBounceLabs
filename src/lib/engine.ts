import { create } from "zustand";
import catalogFile from "../../public/catalog/albums.json";
import { parseHash, playbackSource, reorderQueue, safeEmbed, shuffleIds } from "../../scripts/house-logic.mjs";

export type Track = {
  title: string;
  sunoId?: string;
  src?: string;
  duration?: number;
};

export type Album = {
  id: string;
  title: string;
  artist?: string;
  type?: string;
  year?: string;
  description?: string;
  cover?: string;
  suno?: string;
  tracks: Track[];
};

export type QueueItem = { albumId: string; index: number };

type Status = "idle" | "loading" | "playing" | "paused" | "embedded" | "error";

type EngineState = {
  albums: Album[];
  ready: boolean;
  loadError: string;
  queue: QueueItem[];
  cursor: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  volume: number;
  muted: boolean;
  rate: number;
  status: Status;
  message: string;
  embed: string;
  analyzed: boolean;
  vizMode: string;
  room: string;
  albumId: string;
  sleepAt: number;
  favorites: { albums: string[]; tracks: string[] };
  history: QueueItem[];
  playlists: { id: string; name: string; items: QueueItem[] }[];
  resume: (QueueItem & { position?: number }) | null;
  loadCatalog: () => Promise<void>;
  go: (room: string, albumId?: string) => void;
  suspendForExternal: () => void;
  playAlbum: (albumId: string, start?: number, shuffled?: boolean) => void;
  playStation: (items: QueueItem[]) => void;
  playQueue: (items: QueueItem[]) => void;
  queueAlbum: (albumId: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  jump: (i: number) => void;
  setVolume: (n: number) => void;
  setMuted: (v: boolean) => void;
  setRate: (n: number) => void;
  setRepeat: () => void;
  setShuffle: () => void;
  setViz: (mode: string) => void;
  moveQueue: (from: number, dir: number) => void;
  toggleFavAlbum: (id: string) => void;
  toggleFavTrack: (albumId: string, index: number) => void;
  savePlaylist: (name: string) => void;
  armSleep: (minutes: number) => void;
  resumeSaved: () => void;
};

const KEY = "mbl-personal-v1";
const seeded = ((catalogFile as { albums?: Album[] }).albums || []) as Album[];
const audio = typeof Audio !== "undefined" ? new Audio() : (null as unknown as HTMLAudioElement);
let playRequest = 0;

function readPersonal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      favorites: raw.favorites || { albums: [], tracks: [] },
      history: raw.history || [],
      playlists: raw.playlists || [],
      volume: typeof raw.volume === "number" ? raw.volume : 0.9,
      vizMode: raw.vizMode || "signature",
      rate: raw.rate || 1,
      resume: raw.resume || null,
    };
  } catch {
    return {
      favorites: { albums: [], tracks: [] },
      history: [],
      playlists: [],
      volume: 0.9,
      vizMode: "signature",
      rate: 1,
      resume: null,
    };
  }
}

function writePersonal(partial: Record<string, unknown>) {
  const prev = readPersonal();
  localStorage.setItem(KEY, JSON.stringify({ ...prev, ...partial }));
}

export function getAudio() {
  return audio;
}

/** When the official iframe owns playback, clear native audio and OS controls. */
function stopNativeForEmbed() {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = null;
      for (const action of ["play", "pause", "nexttrack", "previoustrack"] as const) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    } catch {
      // Media Session API is optional.
    }
  }
}

export const useHouse = create<EngineState>((set, get) => {
  if (audio) {
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.addEventListener("waiting", () => {
      if (!get().embed) set({ status: "loading" });
    });
    audio.addEventListener("playing", () => {
      if (!get().embed) set({ status: "playing", message: "" });
    });
    audio.addEventListener("pause", () => {
      if (!get().embed && get().status !== "error") set({ status: "paused" });
    });
    audio.addEventListener("ended", () => {
      if (!get().embed) get().next();
    });
    audio.addEventListener("error", () => {
      if (get().embed) return;
      const item = get().queue[get().cursor];
      const album = get().albums.find((a) => a.id === item?.albumId);
      const track = album?.tracks[item?.index ?? -1];
      const embed = safeEmbed(track?.sunoId);
      if (embed) {
        set({
          status: "embedded",
          embed,
          message: "Use the Play and seek controls inside the official Suno player.",
          analyzed: false,
          sleepAt: 0,
        });
        stopNativeForEmbed();
        return;
      }
      set({ status: "error", message: "This track has no playable source.", embed: "", analyzed: false });
    });
    audio.addEventListener("timeupdate", () => {
      const item = get().queue[get().cursor];
      if (!item || !audio.currentTime) return;
      if (Math.floor(audio.currentTime) % 5 === 0) {
        writePersonal({
          resume: { ...item, position: audio.currentTime },
          volume: get().volume,
          vizMode: get().vizMode,
          rate: get().rate,
          favorites: get().favorites,
          history: get().history,
          playlists: get().playlists,
        });
      }
      if (get().sleepAt && Date.now() > get().sleepAt) {
        audio.pause();
        set({ sleepAt: 0, status: "paused", message: "Sleep timer stopped playback." });
      }
    });
  }

  const saved = typeof localStorage !== "undefined" ? readPersonal() : null;

  return {
    albums: seeded,
    ready: seeded.length > 0,
    loadError: "",
    queue: [],
    cursor: 0,
    shuffle: false,
    repeat: "off",
    volume: saved?.volume ?? 0.9,
    muted: false,
    rate: saved?.rate ?? 1,
    status: "idle",
    message: "",
    embed: "",
    analyzed: false,
    vizMode: saved?.vizMode || "signature",
    room: "lobby",
    albumId: "",
    sleepAt: 0,
    favorites: saved?.favorites || { albums: [], tracks: [] },
    history: saved?.history || [],
    playlists: saved?.playlists || [],
    resume: saved?.resume || null,

    loadCatalog: async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}catalog/albums.json`);
        if (!res.ok) throw new Error("Catalog missing");
        const data = await res.json();
        const albums = (data.albums || []) as Album[];
        const parsed = parseHash(location.hash);
        const albumId = parsed.room === "album" && albums.some((a) => a.id === parsed.albumId) ? parsed.albumId : "";
        set({
          albums,
          ready: true,
          loadError: "",
          room: albumId ? "album" : parsed.room,
          albumId,
        });
      } catch {
        set({ ready: true, loadError: get().albums.length ? "" : "The catalog did not load." });
      }
    },

    suspendForExternal: () => {
      // One listening surface at a time: remove both the MBL native stream
      // and a previously mounted Suno iframe before activating SoundCloud.
      playRequest += 1;
      stopNativeForEmbed();
      set({ embed: "", status: "idle", message: "", sleepAt: 0, analyzed: false });
    },

    go: (requestedRoom, albumId) => {
      const room = requestedRoom === "lounge" ? "desk" : requestedRoom;
      if (room === "decks") {
        // One authoritative DJ audio surface: stop/unmount the house player
        // before opening the independent Backspin performance booth.
        playRequest += 1;
        if (audio) {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        }
        stopNativeForEmbed();
        set({ embed: "", status: "idle", message: "", queue: [], cursor: 0, sleepAt: 0, analyzed: false });
      }
      const id = albumId || (room === "album" ? get().albumId : "");
      set({ room, albumId: room === "album" ? id : "" });
      const next = room === "album" && id ? `#/album/${id}` : `#/${room}`;
      const keepTrack = room === "album" && id && location.hash.startsWith(`#/album/${id}/`);
      if (location.hash !== next && !keepTrack) location.hash = next;
      const album = get().albums.find((a) => a.id === id);
      document.title = room === "album" && album ? `${album.title} · MoreBounceLabs` : room === "lobby" ? "MoreBounceLabs" : `MoreBounceLabs · ${room}`;
    },

    playAlbum: (albumId, start = 0, shuffled = false) => {
      const album = get().albums.find((a) => a.id === albumId);
      if (!album) return;
      let items = album.tracks.map((_, index) => ({ albumId, index }));
      if (shuffled) items = shuffleIds(items);
      const cursor = shuffled ? 0 : Math.min(start, items.length - 1);
      set({ queue: items, cursor, embed: "" });
      void startCurrent(get, set);
    },

    playStation: (items) => {
      if (!items.length) return;
      set({ queue: shuffleIds(items), cursor: 0, embed: "" });
      void startCurrent(get, set);
    },

    playQueue: (items) => {
      if (!items.length) return;
      set({ queue: items, cursor: 0, embed: "" });
      void startCurrent(get, set);
    },

    queueAlbum: (albumId) => {
      const album = get().albums.find((a) => a.id === albumId);
      if (!album) return;
      const items = album.tracks.map((_, index) => ({ albumId, index }));
      const empty = get().queue.length === 0;
      set({ queue: [...get().queue, ...items], cursor: empty ? 0 : get().cursor, embed: empty ? "" : get().embed });
      if (empty) void startCurrent(get, set);
    },

    toggle: () => {
      if (get().embed || !audio) return;
      if (!get().queue.length) {
        const first = get().albums[0];
        if (first) get().playAlbum(first.id, 0);
        return;
      }
      if (audio.paused) void audio.play().catch(() => set({ message: "Press play again. The browser blocked autoplay." }));
      else audio.pause();
    },

    next: () => {
      const { queue, cursor, repeat, shuffle } = get();
      if (!queue.length) return;
      if (repeat === "one" && !get().embed) {
        if (audio) {
          audio.currentTime = 0;
          void audio.play();
        }
        return;
      }
      if (shuffle && queue.length > 1) {
        let pick = cursor;
        while (pick === cursor) pick = Math.floor(Math.random() * queue.length);
        set({ cursor: pick, embed: "" });
        void startCurrent(get, set);
        return;
      }
      let next = cursor + 1;
      if (next >= queue.length) {
        if (repeat === "all") next = 0;
        else {
          if (!get().embed) {
            audio?.pause();
            set({ status: "paused" });
          }
          return;
        }
      }
      set({ cursor: next, embed: "" });
      void startCurrent(get, set);
    },

    prev: () => {
      if (!get().embed && audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }
      const cursor = Math.max(0, get().cursor - 1);
      set({ cursor, embed: "" });
      void startCurrent(get, set);
    },
    jump: (i: number) => {
      if (i < 0 || i >= get().queue.length) return;
      set({ cursor: i, embed: "" });
      void startCurrent(get, set);
    },

    seek: (sec) => {
      if (!get().embed && audio && Number.isFinite(sec)) audio.currentTime = sec;
    },
    setVolume: (n) => {
      const volume = Math.min(1, Math.max(0, n));
      if (audio) audio.volume = get().muted ? 0 : volume;
      set({ volume });
    },
    setMuted: (v) => {
      if (audio) audio.volume = v ? 0 : get().volume;
      set({ muted: v });
    },
    setRate: (n) => {
      if (audio) audio.playbackRate = n;
      set({ rate: n });
      writePersonal({ rate: n });
    },
    setRepeat: () => {
      const order = ["off", "all", "one"] as const;
      const repeat = order[(order.indexOf(get().repeat) + 1) % order.length];
      set({ repeat });
    },
    setShuffle: () => set({ shuffle: !get().shuffle }),
    setViz: (vizMode) => {
      set({ vizMode });
      writePersonal({ vizMode });
    },
    moveQueue: (from, dir) => {
      const { queue, cursor } = get();
      const result = reorderQueue(queue, cursor, from, dir);
      if (result.queue !== queue) set(result);
    },
    toggleFavAlbum: (id) => {
      const albums = new Set(get().favorites.albums);
      if (albums.has(id)) albums.delete(id);
      else albums.add(id);
      const favorites = { ...get().favorites, albums: [...albums] };
      set({ favorites });
      writePersonal({ favorites });
    },
    toggleFavTrack: (albumId, index) => {
      const key = `${albumId}:${index}`;
      const tracks = new Set(get().favorites.tracks);
      if (tracks.has(key)) tracks.delete(key);
      else tracks.add(key);
      const favorites = { ...get().favorites, tracks: [...tracks] };
      set({ favorites });
      writePersonal({ favorites });
    },
    savePlaylist: (name) => {
      const playlists = [
        { id: `${Date.now()}`, name: name || "Untitled", items: get().queue.slice() },
        ...get().playlists,
      ].slice(0, 20);
      set({ playlists });
      writePersonal({ playlists });
    },
    armSleep: (minutes) => {
      if (get().embed) return; // An iframe cannot be paused by our sleep timer.
      set({ sleepAt: minutes ? Date.now() + minutes * 60000 : 0 });
    },
    resumeSaved: () => {
      const savedNow = readPersonal();
      if (!savedNow.resume) return;
      set({
        queue: [savedNow.resume],
        cursor: 0,
      });
      void startCurrent(get, set).then(() => {
        if (!get().embed && audio && savedNow.resume.position) audio.currentTime = savedNow.resume.position;
      });
    },
  };
});

async function startCurrent(
  get: () => EngineState,
  set: (partial: Partial<EngineState>) => void,
) {
  const { queue, cursor, albums, volume, muted, rate } = get();
  const item = queue[cursor];
  const album = albums.find((a) => a.id === item?.albumId);
  const track = album?.tracks[item?.index ?? -1];
  if (!track || !audio) return;
  const request = ++playRequest;
  const source = playbackSource(track);
  if (source.kind === "embed") {
    set({
      status: "embedded",
      embed: source.url,
      message: "Use the Play and seek controls inside the official Suno player.",
      analyzed: false,
      sleepAt: 0,
    });
    stopNativeForEmbed();
    return;
  }
  if (source.kind === "none") {
    set({ status: "error", embed: "", message: "No supported playback source for this song.", analyzed: false });
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    return;
  }
  set({ status: "loading", message: "", embed: "", analyzed: false });
  audio.volume = muted ? 0 : volume;
  audio.playbackRate = rate;
  audio.src = source.url;
  try {
    await audio.play();
    if (request !== playRequest || get().embed) return;
    const history = [item, ...get().history.filter((h) => !(h.albumId === item.albumId && h.index === item.index))].slice(0, 30);
    set({ history, analyzed: true });
    writePersonal({ history });
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: album?.artist || "Mikey More Bounce",
          album: album?.title || "",
          artwork: album?.cover ? [{ src: album.cover }] : [],
        });
        navigator.mediaSession.setActionHandler("play", () => void audio.play());
        navigator.mediaSession.setActionHandler("pause", () => audio.pause());
        navigator.mediaSession.setActionHandler("nexttrack", () => get().next());
        navigator.mediaSession.setActionHandler("previoustrack", () => get().prev());
      } catch {
        /* lock-screen controls are optional */
      }
    }
  } catch {
    if (request !== playRequest || get().embed) return;
    const fallback = safeEmbed(track.sunoId);
    if (fallback) {
      set({
        status: "embedded",
        embed: fallback,
        message: "Native playback was unavailable. Use the official Suno player below.",
        analyzed: false,
        sleepAt: 0,
      });
      stopNativeForEmbed();
    } else {
      set({ message: "This audio could not be played. Try another song.", status: "error", analyzed: false });
    }
  }
}

export function currentTrack(state: EngineState) {
  const item = state.queue[state.cursor];
  const album = state.albums.find((a) => a.id === item?.albumId);
  const track = album?.tracks[item?.index ?? -1];
  return { item, album, track };
}
