import { useEffect, useMemo, useState } from "react";
import {
  Disc3,
  Heart,
  ListMusic,
  Pause,
  Play,
  Radio,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { collectStation, fmt, parseHash, runtime, safeEmbed, safeHttps, sharedTrackIndex, STATIONS } from "../../scripts/house-logic.mjs";
import { currentTrack, getAudio, useHouse, type Album } from "@/lib/engine";
import { VIZ_MODES, VizCanvas } from "@/components/VizCanvas";

const ROOMS = [
  ["lobby", "Lobby"],
  ["vault", "Vault"],
  ["lounge", "Lounge"],
  ["lab", "Lab"],
  ["radio", "Radio"],
  ["decks", "Decks"],
  ["desk", "Desk"],
] as const;

export function HouseApp() {
  const house = useHouse();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"listed" | "title" | "tracks">("listed");
  const [layout, setLayout] = useState<"grid" | "list" | "bin">("grid");
  const [spot, setSpot] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [copied, setCopied] = useState("");
  const [egg, setEgg] = useState(0);
  const [vizLive, setVizLive] = useState(false);
  const [sharedTrack, setSharedTrack] = useState("");

  useEffect(() => {
    void house.loadCatalog();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const onHash = () => {
      const parsed = parseHash(location.hash);
      setSharedTrack(parsed.room === "album" ? parsed.track : "");
      if (parsed.room === "album" && parsed.albumId) house.go("album", parsed.albumId);
      else if (parsed.room !== "album") house.go(parsed.room);
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    const keys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        house.toggle();
      }
      if (e.key === "ArrowRight") house.seek((getAudio()?.currentTime || 0) + 5);
      if (e.key === "ArrowLeft") house.seek(Math.max(0, (getAudio()?.currentTime || 0) - 5));
    };
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", keys);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduced || house.room !== "lobby") return;
    const id = window.setInterval(() => setSpot((n) => n + 1), 7000);
    return () => window.clearInterval(id);
  }, [reduced, house.room]);

  const albums = house.albums;
  const now = currentTrack(house);
  const featured = albums[2] || albums[0];
  const spotAlbum = albums.length ? albums[spot % Math.min(albums.length, 8)] : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = albums.filter((a) => {
      if (!q) return true;
      const hay = [a.title, a.description, ...(a.tracks || []).map((t) => t.title)].join(" ").toLowerCase();
      return hay.includes(q);
    });
    if (sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "tracks") list = [...list].sort((a, b) => b.tracks.length - a.tracks.length);
    return list;
  }, [albums, query, sort]);

  const openAlbum = house.albums.find((a) => a.id === house.albumId);
  const selectedTrackIndex = openAlbum ? sharedTrackIndex(sharedTrack, openAlbum.tracks.length) : null;
  const invalidSharedTrack = sharedTrack !== "" && selectedTrackIndex === null;
  const hearing = house.status === "playing" && vizLive && !house.embed;
  const vizNote = hearing
    ? "These modes are reading the live audio."
    : house.embed
      ? "Ambient motion. The official Suno player cannot be analyzed in the browser."
      : "Ambient motion until a direct stream is playing through the house player.";

  function share(album: Album, trackIndex?: number) {
    const url = `${location.origin}${location.pathname}#/album/${album.id}${trackIndex != null ? `/${trackIndex}` : ""}`;
    const text = trackIndex != null ? `${album.tracks[trackIndex]?.title} — ${album.title}` : album.title;
    if (navigator.share) {
      void navigator.share({ title: text, url }).catch(() => copy(url));
    } else copy(url);
  }

  function copy(url: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied("Link copied");
      window.setTimeout(() => setCopied(""), 1600);
    });
  }

  return (
    <div className={`${house.embed ? "player-safe-embed" : "player-safe"} min-h-screen bg-bg text-cream`}>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <button
            className="text-left"
            onClick={() => {
              setEgg((n) => n + 1);
              house.go("lobby");
            }}
          >
            <span className="eq mr-2" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="font-display text-2xl tracking-tight">MoreBounceLabs</span>
            <span className="mt-0.5 block text-xs uppercase tracking-[0.18em] text-amber">MBL</span>
          </button>
          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Rooms">
            {ROOMS.map(([id, label]) => (
              <button
                key={id}
                className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${house.room === id ? "bg-amber text-ink" : "text-mist"}`}
                onClick={() => house.go(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (house.room === "lobby") house.go("vault");
            }}
            placeholder="Search albums and tracks"
            aria-label="Search albums and tracks"
            className="min-h-11 w-full rounded-full border border-line bg-surface px-4 text-sm sm:w-56"
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {house.loadError && <p className="mb-4 text-heat">{house.loadError}</p>}
        {!house.ready && <p className="text-mist">Opening the house…</p>}
        {house.room === "lobby" && featured && (
          <Lobby
            featured={featured}
            spot={spotAlbum}
            albums={albums}
            onPlay={() => house.playAlbum(featured.id, 0)}
            onOpen={(id) => house.go("album", id)}
            onVault={() => house.go("vault")}
            egg={egg > 4}
          />
        )}
        {house.room === "lobby" && house.resume && house.status === "idle" && (
          <button className="mt-4 min-h-11 rounded-full bg-surface px-4" onClick={house.resumeSaved}>
            Resume the last track on this browser
          </button>
        )}
        {house.room === "vault" && (
          <Vault
            albums={filtered}
            layout={layout}
            sort={sort}
            setLayout={setLayout}
            setSort={setSort}
            onOpen={(id) => house.go("album", id)}
            onPlay={(id) => house.playAlbum(id, 0)}
          />
        )}
        {house.room === "album" && openAlbum && (
          <AlbumView
            album={openAlbum}
            selectedTrackIndex={selectedTrackIndex}
            invalidSharedTrack={invalidSharedTrack}
            fav={house.favorites.albums.includes(openAlbum.id)}
            favTracks={house.favorites.tracks}
            onPlay={(i) => house.playAlbum(openAlbum.id, i || 0)}
            onShuffle={() => house.playAlbum(openAlbum.id, 0, true)}
            onFav={() => house.toggleFavAlbum(openAlbum.id)}
            onFavTrack={(i) => house.toggleFavTrack(openAlbum.id, i)}
            onShare={(i) => share(openAlbum, i)}
            onQueue={() => house.queueAlbum(openAlbum.id)}
            copied={copied}
          />
        )}
        {house.room === "lounge" && (
          <Lounge
            album={now.album}
            track={now.track}
            queue={house.queue}
            cursor={house.cursor}
            albums={albums}
            mode={house.vizMode}
            reduced={reduced}
            note={vizNote}
            onLive={setVizLive}
            onMode={house.setViz}
            onJump={(i) => house.jump(i)}
            onMove={house.moveQueue}
            onSleep={house.armSleep}
            sleepAt={house.sleepAt}
            embedded={Boolean(house.embed)}
            spinning={house.status === "playing" && !house.embed}
          />
        )}
        {house.room === "lab" && (
          <section>
            <h1 className="font-display text-4xl">Visual lab</h1>
            <p className="mt-2 max-w-xl text-mist">{vizNote}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {VIZ_MODES.map((mode) => (
                <button
                  key={mode}
                  className={`min-h-11 rounded-full px-3 text-sm capitalize ${house.vizMode === mode ? "bg-heat text-cream" : "bg-surface"}`}
                  onClick={() => house.setViz(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <VizCanvas mode={house.vizMode} reduced={reduced} onLive={setVizLive} />
            </div>
          </section>
        )}
        {house.room === "radio" && <RadioRoom albums={albums} onPlay={house.playStation} />}
        {house.room === "decks" && <Decks albums={albums} />}
        {house.room === "desk" && (
          <Desk
            albums={albums}
            playlists={house.playlists}
            history={house.history}
            onSave={house.savePlaylist}
            onPlay={house.playQueue}
          />
        )}
        {house.ready && house.room === "album" && !openAlbum && <p>That album is not in the catalog.</p>}
      </main>

      <Player onLounge={() => house.go("lounge")} />
    </div>
  );
}

function Lobby({
  featured,
  spot,
  albums,
  onPlay,
  onOpen,
  onVault,
  egg,
}: {
  featured: Album;
  spot?: Album;
  albums: Album[];
  onPlay: () => void;
  onOpen: (id: string) => void;
  onVault: () => void;
  egg: boolean;
}) {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.22em] text-amber">Making music to make you feel good, baby.</p>
      <div className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
        <button className="sleeve vinyl mx-auto w-full max-w-xs" onClick={() => onOpen(featured.id)}>
          <img src={featured.cover} alt="" className="aspect-square w-full rounded-full object-cover shadow-2xl" />
        </button>
        <div>
          <p className="text-mist">Mikey More Bounce</p>
          <h1 className="font-display text-5xl leading-none sm:text-6xl">{featured.title}</h1>
          <p className="mt-3 max-w-lg text-mist">{featured.description || "A record from the house."}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="min-h-12 rounded-full bg-heat px-6 font-semibold text-cream" onClick={onPlay}>
              Play music
            </button>
            <button className="min-h-12 rounded-full border border-line px-5" onClick={onVault}>
              Record vault
            </button>
          </div>
          {egg && <p className="mt-3 text-amber">More bounce. You found the house motto.</p>}
        </div>
      </div>
      {spot && (
        <button className="mt-8 flex w-full items-center gap-4 rounded-3xl bg-surface p-3 text-left" onClick={() => onOpen(spot.id)}>
          <img src={spot.cover} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <span>
            <span className="block text-xs uppercase tracking-widest text-mist">Spotlight</span>
            <span className="font-display text-2xl">{spot.title}</span>
          </span>
        </button>
      )}
      <h2 className="mt-8 font-display text-2xl">On the shelves</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {albums.slice(0, 4).map((album) => (
          <button key={album.id} className="text-left" onClick={() => onOpen(album.id)}>
            <img src={album.cover} alt="" className="aspect-square w-full rounded-2xl object-cover" />
            <span className="mt-2 block text-sm">{album.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Vault({
  albums,
  layout,
  sort,
  setLayout,
  setSort,
  onOpen,
  onPlay,
}: {
  albums: Album[];
  layout: "grid" | "list" | "bin";
  sort: "listed" | "title" | "tracks";
  setLayout: (v: "grid" | "list" | "bin") => void;
  setSort: (v: "listed" | "title" | "tracks") => void;
  onOpen: (id: string) => void;
  onPlay: (id: string) => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl">Record vault</h1>
        <div className="flex flex-wrap gap-2">
          <select className="min-h-11 rounded-full bg-surface px-3" value={sort} aria-label="Sort albums" onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="listed">As listed</option>
            <option value="title">Title</option>
            <option value="tracks">Track count</option>
          </select>
          {(["grid", "list", "bin"] as const).map((mode) => (
            <button key={mode} className={`min-h-11 rounded-full px-3 capitalize ${layout === mode ? "bg-amber text-ink" : "bg-surface"}`} onClick={() => setLayout(mode)}>
              {mode === "bin" ? "Record bin" : mode}
            </button>
          ))}
        </div>
      </div>
      {albums.length === 0 && <p className="mt-6 text-mist">No records match that search.</p>}
      {albums.length > 0 && layout === "bin" ? (
        <div className="bin mt-5 flex gap-4 overflow-x-auto pb-4">
          {albums.map((album) => (
            <button key={album.id} className="sleeve w-44 shrink-0 text-left" onClick={() => onOpen(album.id)}>
              <img src={album.cover} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <span className="mt-2 block text-sm">{album.title}</span>
            </button>
          ))}
        </div>
      ) : layout === "list" ? (
        <ul className="mt-4 divide-y divide-line">
          {albums.map((album) => (
            <li key={album.id} className="flex items-center gap-3 py-2">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(album.id)}>
                <img src={album.cover} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <span className="min-w-0">
                  <span className="block truncate">{album.title}</span>
                  <span className="text-sm text-mist">{album.tracks.length} tracks</span>
                </span>
              </button>
              <button className="min-h-11 min-w-11" aria-label={`Play ${album.title}`} onClick={() => onPlay(album.id)}>
                <Play />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {albums.map((album) => (
            <button key={album.id} className="sleeve text-left" onClick={() => onOpen(album.id)}>
              <img src={album.cover} alt="" className="aspect-square w-full rounded-2xl object-cover" />
              <span className="mt-2 block font-medium">{album.title}</span>
              <span className="text-sm text-mist">
                {album.type} · {album.tracks.length} tracks
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AlbumView({
  album,
  selectedTrackIndex,
  invalidSharedTrack,
  fav,
  favTracks,
  onPlay,
  onShuffle,
  onFav,
  onFavTrack,
  onShare,
  onQueue,
  copied,
}: {
  album: Album;
  selectedTrackIndex: number | null;
  invalidSharedTrack: boolean;
  fav: boolean;
  favTracks: string[];
  onPlay: (i?: number) => void;
  onShuffle: () => void;
  onFav: () => void;
  onFavTrack: (i: number) => void;
  onShare: (i?: number) => void;
  onQueue: () => void;
  copied: string;
}) {
  const seconds = runtime(album.tracks);
  return (
    <section className="grid gap-6 md:grid-cols-[280px_1fr]">
      <img src={album.cover} alt="" className="aspect-square w-full rounded-3xl object-cover" />
      <div>
        <p className="text-amber">
          {album.type} · {album.year} · {album.artist}
        </p>
        <h1 className="font-display text-5xl leading-none">{album.title}</h1>
        <p className="mt-3 max-w-xl text-mist">{album.description}</p>
        <p className="mt-2 text-sm text-mist">
          {album.tracks.length} tracks
          {seconds ? ` · ${fmt(seconds)}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="min-h-11 rounded-full bg-heat px-4" onClick={() => onPlay(0)}>
            Play album
          </button>
          <button className="min-h-11 rounded-full bg-surface px-4" onClick={onShuffle}>
            Shuffle album
          </button>
          <button className="min-h-11 rounded-full bg-surface px-4" onClick={onQueue}>
            Add to queue
          </button>
          <button className="min-h-11 rounded-full bg-surface px-4" onClick={onFav}>
            {fav ? "Favorited" : "Favorite"}
          </button>
          <button className="min-h-11 rounded-full bg-surface px-4" onClick={() => onShare()}>
            Share
          </button>
          {album.suno && (
            <a className="inline-flex min-h-11 items-center rounded-full border border-line px-4" href={album.suno} target="_blank" rel="noreferrer">
              On Suno
            </a>
          )}
        </div>
        {copied && <p className="mt-2 text-sm text-amber">{copied}</p>}
        {selectedTrackIndex !== null && (
          <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/60 bg-raised p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-amber">Shared song · Track {selectedTrackIndex + 1}</p>
              <p className="font-display text-xl">{album.tracks[selectedTrackIndex]?.title}</p>
              <p className="mt-1 text-sm text-mist">Ready to play when you are. Your browser won't start music without your tap.</p>
            </div>
            <button className="min-h-11 rounded-full bg-heat px-5 font-semibold" onClick={() => onPlay(selectedTrackIndex)}>
              Play this song
            </button>
          </div>
        )}
        {invalidSharedTrack && (
          <p role="status" className="mt-5 rounded-2xl border border-line bg-surface p-3 text-sm text-mist">
            That song link doesn't match a track on this album. You can still play the album below.
          </p>
        )}
        <ol className="mt-6 divide-y divide-line">
          {album.tracks.map((track, i) => (
            <li
              key={`${track.sunoId}-${i}`}
              aria-current={selectedTrackIndex === i ? "location" : undefined}
              className={`flex items-center gap-2 py-1 ${selectedTrackIndex === i ? "rounded-xl border border-amber/60 bg-raised px-2" : ""}`}
            >
              <button className="min-h-11 flex-1 text-left" onClick={() => onPlay(i)}>
                <span className="mr-3 text-mist">{String(i + 1).padStart(2, "0")}</span>
                {track.title}
                <span className="ml-2 text-sm text-mist">{track.duration ? fmt(track.duration) : ""}</span>
              </button>
              <button className="min-h-11 min-w-11" aria-label="Favorite track" onClick={() => onFavTrack(i)}>
                <Heart className={favTracks.includes(`${album.id}:${i}`) ? "fill-heat text-heat" : ""} />
              </button>
              <button className="min-h-11 text-sm text-mist" onClick={() => onShare(i)}>
                Link
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Lounge({
  album,
  track,
  queue,
  cursor,
  albums,
  mode,
  reduced,
  note,
  onLive,
  onMode,
  onJump,
  onMove,
  onSleep,
  sleepAt,
  embedded,
  spinning,
}: {
  album?: Album;
  track?: { title: string };
  queue: { albumId: string; index: number }[];
  cursor: number;
  albums: Album[];
  mode: string;
  reduced: boolean;
  note: string;
  onLive: (live: boolean) => void;
  onMode: (m: string) => void;
  onJump: (i: number) => void;
  onMove: (from: number, dir: number) => void;
  onSleep: (m: number) => void;
  sleepAt: number;
  embedded: boolean;
  spinning: boolean;
}) {
  return (
    <section>
      <h1 className="font-display text-4xl">Listening lounge</h1>
      <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
        {album?.cover && <img src={album.cover} alt="" className={`aspect-square w-full rounded-3xl object-cover ${reduced || !spinning ? "" : "spin"}`} style={reduced || !spinning ? undefined : { animation: "spin 18s linear infinite" }} />}
        <div>
          <p className="text-mist">{album?.title || "Nothing spinning"}</p>
          <p className="font-display text-4xl">{track?.title || "Pick a record"}</p>
          <p className="mt-2 text-sm text-mist">{album?.description}</p>
          <p className="mt-3 text-sm text-amber">{note}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["signature", "spectrum", "kaleido", "tunnel"].map((m) => (
              <button key={m} className={`min-h-11 rounded-full px-3 capitalize ${mode === m ? "bg-amber text-ink" : "bg-surface"}`} onClick={() => onMode(m)}>
                {m}
              </button>
            ))}
            <button className="min-h-11 rounded-full bg-surface px-3" onClick={() => document.documentElement.requestFullscreen?.()}>
              Fullscreen
            </button>
            {!embedded && [15, 30, 45].map((m) => (
              <button key={m} className="min-h-11 rounded-full bg-surface px-3" onClick={() => onSleep(m)}>
                Sleep {m}m
              </button>
            ))}
            {!embedded && sleepAt > 0 && (
              <button className="min-h-11 text-sm text-mist" onClick={() => onSleep(0)}>
                Cancel sleep
              </button>
            )}
            {embedded && <p className="text-sm text-mist">Suno handles its own playback. The house sleep timer cannot pause an embedded track.</p>}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <VizCanvas mode={mode} reduced={reduced} onLive={onLive} />
      </div>
      <ol className="mt-4 max-h-64 overflow-auto">
        {queue.map((item, i) => {
          const a = albums.find((x) => x.id === item.albumId);
          const t = a?.tracks[item.index];
          return (
            <li key={`${item.albumId}-${item.index}-${i}`} className="flex items-center gap-1">
              <button className={`min-h-11 flex-1 text-left ${i === cursor ? "text-amber" : "text-mist"}`} onClick={() => onJump(i)}>
                {i === cursor ? (embedded ? "Selected · " : "Now · ") : `${i + 1}. `}
                {t?.title} — {a?.title}
              </button>
              <button className="min-h-11 min-w-11 text-mist" aria-label="Move earlier" onClick={() => onMove(i, -1)}>
                ↑
              </button>
              <button className="min-h-11 min-w-11 text-mist" aria-label="Move later" onClick={() => onMove(i, 1)}>
                ↓
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RadioRoom({ albums, onPlay }: { albums: Album[]; onPlay: (items: { albumId: string; index: number }[]) => void }) {
  return (
    <section>
      <h1 className="font-display text-4xl">Radio tower</h1>
      <p className="mt-2 max-w-xl text-mist">Stations are curated from album titles already in the catalog. They are not genre classifications.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {STATIONS.map((station) => {
          const items = collectStation(albums, station.id);
          return (
            <button key={station.id} className="rounded-3xl bg-surface p-4 text-left" onClick={() => onPlay(items)}>
              <Radio className="text-amber" />
              <span className="mt-2 block font-display text-2xl">{station.name}</span>
              <span className="mt-1 block text-sm text-mist">{station.blurb}</span>
              <span className="mt-2 block text-sm">{items.length} tracks</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Decks({ albums }: { albums: Album[] }) {
  const [a, setA] = useState(albums[0]?.id || "");
  const [b, setB] = useState(albums[1]?.id || albums[0]?.id || "");
  const [cross, setCross] = useState(0.5);
  const [note, setNote] = useState("Two independent players. Volume crossfade only. This is not beatmatched.");
  useEffect(() => {
    if (!a && albums[0]) setA(albums[0].id);
    if (!b && (albums[1] || albums[0])) setB((albums[1] || albums[0]).id);
  }, [albums, a, b]);
  useEffect(() => {
    const left = document.getElementById("deck-a") as HTMLAudioElement | null;
    const right = document.getElementById("deck-b") as HTMLAudioElement | null;
    if (left) left.volume = Math.min(1, (1 - cross) * 2);
    if (right) right.volume = Math.min(1, cross * 2);
  }, [cross, a, b]);
  function load(which: "a" | "b", id: string) {
    const album = albums.find((x) => x.id === id);
    if (which === "a") setA(id);
    else setB(id);
    setNote(album ? `Selected ${album.title}. Press play on that deck. Direct file access is source-dependent.` : "No album selected.");
  }
  return (
    <section>
      <h1 className="font-display text-4xl">DJ decks</h1>
      <p className="mt-2 text-mist">{note}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(["a", "b"] as const).map((side) => (
          <div key={side} className="rounded-3xl bg-surface p-4">
            <label className="text-sm text-mist">Deck {side.toUpperCase()}</label>
            <select className="mt-2 min-h-11 w-full rounded-xl bg-bg px-2" value={side === "a" ? a : b} onChange={(e) => load(side, e.target.value)}>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>
            <audio
              id={side === "a" ? "deck-a" : "deck-b"}
              controls
              preload="metadata"
              crossOrigin="anonymous"
              src={safeHttps(albums.find((album) => album.id === (side === "a" ? a : b))?.tracks[0]?.src)}
              onError={() => setNote(`Deck ${side.toUpperCase()} could not load this source. Try the main player's Suno fallback.`)}
              className="mt-3 w-full"
            />
          </div>
        ))}
      </div>
      <label className="mt-4 block text-sm text-mist">
        Crossfader
        <input className="mt-2 w-full" type="range" min={0} max={1} step={0.01} value={cross} onChange={(e) => setCross(Number(e.target.value))} />
      </label>
    </section>
  );
}

function Desk({
  albums,
  playlists,
  history,
  onSave,
  onPlay,
}: {
  albums: Album[];
  playlists: { id: string; name: string; items: { albumId: string; index: number }[] }[];
  history: { albumId: string; index: number }[];
  onSave: (name: string) => void;
  onPlay: (items: { albumId: string; index: number }[]) => void;
}) {
  const [name, setName] = useState("My bounce");
  return (
    <section>
      <h1 className="font-display text-4xl">Desk</h1>
      <p className="mt-2 max-w-xl text-mist">
        Favorites and playlists stay in this browser. They do not sync to another phone. This page cannot write to GitHub. Export a file, then commit it to the MoreBounceLabs repo if you want it public.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input className="min-h-11 rounded-full bg-surface px-4" value={name} onChange={(e) => setName(e.target.value)} aria-label="Playlist name" />
        <button className="min-h-11 rounded-full bg-amber px-4 text-ink" onClick={() => onSave(name)}>
          Save queue as playlist
        </button>
        <button
          className="min-h-11 rounded-full bg-surface px-4"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ albums }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "albums.json";
            a.click();
          }}
        >
          Export catalog
        </button>
      </div>
      <h2 className="mt-6 font-display text-2xl">Playlists on this browser</h2>
      <ul className="mt-2 space-y-1 text-mist">
        {playlists.length === 0 && <li>None yet. Play something, then save the queue.</li>}
        {playlists.map((list) => (
          <li key={list.id} className="flex items-center justify-between gap-3">
            <span>
              {list.name} · {list.items.length} tracks
            </span>
            <button className="min-h-11 rounded-full bg-surface px-3 text-cream" onClick={() => onPlay(list.items)}>
              Play
            </button>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 font-display text-2xl">Recently played here</h2>
      <ul className="mt-2 space-y-1 text-mist">
        {history.length === 0 && <li>Nothing yet. It stays on this browser only.</li>}
        {history.slice(0, 8).map((item, i) => {
          const album = albums.find((a) => a.id === item.albumId);
          const track = album?.tracks[item.index];
          return (
            <li key={`${item.albumId}-${item.index}-${i}`}>
              <button className="min-h-11 text-left" onClick={() => onPlay([item])}>
                {track?.title || "Track"} — {album?.title}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-mist">
        To add a Suno album, open it on Suno, copy each song link, and send them over. Automatic album import is not available from a static page. {albums.length} albums are already loaded from the published catalog.
      </p>
    </section>
  );
}

function Player({ onLounge }: { onLounge: () => void }) {
  const house = useHouse();
  const { album, track } = currentTrack(house);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = getAudio();
      setTime(el?.currentTime || 0);
      setDur(el && Number.isFinite(el.duration) ? el.duration : track?.duration || 0);
    }, 400);
    return () => window.clearInterval(id);
  }, [track?.title, track?.duration, track?.sunoId]);
  const speeds = [0.75, 1, 1.25, 1.5];
  if (house.embed) {
    return (
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-amber/40 bg-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl" aria-label="Official Suno music player">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-3">
            {album?.cover && <img src={album.cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber">Official Suno player</p>
              <p className="truncate font-semibold">{track?.title || "Selected song"}</p>
              <p className="truncate text-xs text-mist">{album?.title || "MoreBounceLabs"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="min-h-11 rounded-full border border-line px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                disabled={house.cursor <= 0}
                onClick={house.prev}
                aria-label="Select previous song"
              >
                Previous song
              </button>
              <button
                className="min-h-11 rounded-full border border-line px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                disabled={house.cursor >= house.queue.length - 1}
                onClick={house.next}
                aria-label="Select next song"
              >
                Next song
              </button>
              <button className="min-h-11 rounded-full bg-amber px-3 text-xs font-semibold text-ink" onClick={onLounge}>
                View queue
              </button>
            </div>
          </div>
          <iframe
            key={house.embed}
            title={`Official Suno player for ${track?.title || "selected song"}`}
            src={house.embed}
            allow="autoplay; encrypted-media; fullscreen"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            className="mt-2 h-28 w-full rounded-xl border border-line bg-bg"
          />
          <p className="mt-1 text-xs text-mist">
            Play, pause, seek and volume live inside Suno above. Choosing another song loads its player; playback does not auto-advance.
          </p>
        </div>
      </footer>
    );
  }
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto grid max-w-6xl items-center gap-2 md:grid-cols-[1.2fr_1.4fr_auto]">
        <button className="flex min-w-0 items-center gap-3 text-left" onClick={onLounge}>
          {album?.cover ? <img src={album.cover} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <Disc3 />}
          <span className="min-w-0">
            <span className="block truncate">{track?.title || "Nothing playing"}</span>
            <span className="block truncate text-sm text-mist">{album?.title || "MoreBounceLabs"}</span>
          </span>
        </button>
        <div>
          <div className="flex items-center justify-center gap-1">
            <button className="min-h-11 min-w-11" aria-label="Shuffle" onClick={house.setShuffle}>
              <Shuffle className={house.shuffle ? "text-amber" : ""} />
            </button>
            <button className="min-h-11 min-w-11" aria-label="Previous" onClick={house.prev}>
              <SkipBack />
            </button>
            <button className="min-h-12 min-w-12 rounded-full bg-cream text-ink" aria-label={house.status === "playing" ? "Pause" : "Play"} onClick={house.toggle}>
              {house.status === "playing" ? <Pause className="mx-auto" /> : <Play className="mx-auto" />}
            </button>
            <button className="min-h-11 min-w-11" aria-label="Next" onClick={house.next}>
              <SkipForward />
            </button>
            <button className="min-h-11 min-w-11 text-xs" aria-label={`Repeat ${house.repeat}`} onClick={house.setRepeat}>
              <Repeat className={house.repeat === "off" ? "" : "text-amber"} />
              <span className="block text-[10px] uppercase">{house.repeat}</span>
            </button>
          </div>
          <input
            className="w-full"
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={Math.min(time, dur || 0)}
            aria-label="Seek"
            onChange={(e) => house.seek(Number(e.target.value))}
          />
          <div className="flex justify-between text-xs text-mist">
            <span>{fmt(time)}</span>
            <span>{house.message || house.status}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="min-h-11 min-w-11" aria-label={house.muted ? "Unmute" : "Mute"} onClick={() => house.setMuted(!house.muted)}>
            {house.muted ? <VolumeX /> : <Volume2 />}
          </button>
          <input className="hidden w-24 sm:block" type="range" min={0} max={1} step={0.01} value={house.volume} aria-label="Volume" onChange={(e) => house.setVolume(Number(e.target.value))} />
          <button
            className="min-h-11 min-w-11 text-sm"
            aria-label="Playback speed"
            onClick={() => {
              const i = speeds.indexOf(house.rate);
              house.setRate(speeds[(i + 1) % speeds.length] || 1);
            }}
          >
            {house.rate}×
          </button>
          <button className="min-h-11" aria-label="Open lounge" onClick={onLounge}>
            <ListMusic />
          </button>
        </div>
      </div>
    </footer>
  );
}
