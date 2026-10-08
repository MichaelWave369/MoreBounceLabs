import { useState } from "react";
import { ArrowDown, ArrowUp, Clock3, Download, ListMusic, Save } from "lucide-react";
import { currentTrack, useHouse, type Album } from "@/lib/engine";
import { AgentMixStudio } from "@/components/AgentMixStudio";
import { cleanCatalogTrackNumber } from "@/lib/displayTrackTitle";

type QueueItem = { albumId: string; index: number };
type Playlist = { id: string; name: string; items: QueueItem[] };
const ART = import.meta.env.BASE_URL + "desk/desk-room-bg.png";

export function FieldDesk({ albums, playlists, history, onSave, onPlay }: {
  albums: Album[];
  playlists: Playlist[];
  history: QueueItem[];
  onSave: (name: string) => void;
  onPlay: (items: QueueItem[]) => void;
}) {
  const house = useHouse();
  const [name, setName] = useState("My bounce");
  const [artFailed, setArtFailed] = useState(false);
  const [workspace, setWorkspace] = useState<"desk" | "mix">(() => new URLSearchParams(window.location.search).has("mix") ? "mix" : "desk");
  const { album, track } = currentTrack(house);

  function exportCatalog() {
    const blob = new Blob([JSON.stringify({ albums }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "albums.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="mbl-field-desk relative isolate min-h-[960px] overflow-hidden rounded-3xl border border-amber/30 bg-[#21140e]"
      aria-label="MoreBounceLabs creative headquarters">
      {!artFailed && (
        <img src={ART} alt="" aria-hidden="true" draggable={false}
          onError={() => setArtFailed(true)}
          className="mbl-field-desk-art absolute inset-0 h-full w-full object-cover object-center" />
      )}
      <div className="mbl-field-desk-vignette absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 flex min-h-[960px] flex-col p-4 sm:p-6 lg:p-9">
        <header className={`max-w-xl rounded-2xl border border-white/10 bg-[#140d0bc9] shadow-xl backdrop-blur-sm ${workspace === "mix" ? "px-4 py-3" : "px-5 py-4"}`}>
          <p className="text-xs font-bold uppercase tracking-[0.21em] text-amber">MoreBounceLabs · Creative headquarters</p>
          <h1 className={`font-display ${workspace === "mix" ? "mt-1 text-2xl" : "mt-2 text-4xl sm:text-5xl"}`}>The Desk</h1>
          {workspace === "desk" && (
            <>
              <p className="mt-2 max-w-md text-sm text-[#e6d5c5]">
                The workshop behind the music. Save your sets, organize the queue, and explore the records you've played.
              </p>
              <p className="mt-2 text-xs text-[#cbb8a4]">
                This is your own browser's workspace. Personal playlists and listening history are stored locally.
              </p>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setWorkspace("mix")} aria-pressed={workspace === "mix"}
              className={`min-h-11 rounded-xl border px-4 text-sm ${workspace === "mix" ? "border-fuchsia-300 bg-fuchsia-700/70" : "border-fuchsia-300/50"}`}>Open Agent Mix Studio</button>
            <button type="button" onClick={() => setWorkspace("desk")} aria-pressed={workspace === "desk"}
              className={`min-h-11 rounded-xl border px-4 text-sm ${workspace === "desk" ? "border-amber bg-amber/20" : "border-white/20"}`}>Desk workbench</button>
          </div>
          <p className="mt-3 text-xs text-[#cbb8a4]">
            Desk QA R25 · Mix Exchange v1 · <a className="underline" href={import.meta.env.BASE_URL + "agent/mix-changelog.txt"} target="_blank" rel="noopener noreferrer">View changelog</a>
          </p>
        </header>

        {workspace === "mix" ? (
          <div className="mt-4" id="agent-mix-workspace">
            <AgentMixStudio albums={albums} onPlay={onPlay} />
          </div>
        ) : (
          <>
        <div className="flex-1 min-h-[260px] sm:min-h-[360px] xl:min-h-[450px]" aria-hidden="true" />

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="mbl-field-desk-panel rounded-2xl border border-white/20 p-4 sm:p-5" aria-labelledby="desk-playlists-heading">
            <div className="flex items-center gap-2 text-amber">
              <Save size={18} aria-hidden="true" />
              <h2 id="desk-playlists-heading" className="font-display text-2xl text-cream">Playlists &amp; catalog</h2>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={name} onChange={(event) => setName(event.target.value)}
                aria-label="Playlist name"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#150d0c] px-3 text-cream" />
              <button type="button" onClick={() => onSave(name)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-4 font-semibold text-ink">
                <Save size={16} aria-hidden="true" /> Save queue
              </button>
              <button type="button" onClick={exportCatalog}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-black/30 px-3 text-cream">
                <Download size={16} aria-hidden="true" /> Export catalog
              </button>
            </div>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
              {playlists.length === 0 && <li className="text-[#d2c3b4]">No saved playlists yet. Play a record, then save its queue here.</li>}
              {playlists.map((list) => (
                <li key={list.id} className="flex items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-1.5">
                  <span className="min-w-0 truncate">{list.name} · {list.items.length} tracks</span>
                  <button type="button" className="min-h-11 rounded-full border border-white/25 px-4 text-sm"
                    onClick={() => onPlay(list.items)}>Play</button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[#cbb8a4]">
              To publish more albums for everyone, use <strong>Vault → Update albums</strong>.
              This Desk export does not change the live GitHub catalog.
            </p>
          </section>

          <section className="mbl-field-desk-panel rounded-2xl border border-white/20 p-4 sm:p-5" aria-labelledby="desk-queue-heading">
            <div className="flex items-center gap-2 text-amber">
              <ListMusic size={19} aria-hidden="true" />
              <h2 id="desk-queue-heading" className="font-display text-2xl text-cream">Now playing &amp; queue</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[#eaded1]">{track?.title ? cleanCatalogTrackNumber(track.title) : "Nothing playing"}
                {album?.title ? <span className="block text-xs text-[#cbb8a4]">{album.title}</span> : null}
              </p>
              <span className="text-xs text-[#cbb8a4]">{house.queue.length} tracks · {house.embed ? "Suno controls playback" : house.status}</span>
            </div>
            <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {house.queue.length === 0 && <li className="text-sm text-[#d2c3b4]">Your queue is empty. Pick an album from the Vault or Radio.</li>}
              {house.queue.map((item, index) => {
                const sourceAlbum = albums.find((entry) => entry.id === item.albumId);
                const song = sourceAlbum?.tracks[item.index];
                return (
                  <li key={item.albumId + ":" + item.index + ":" + index}
                    className="flex items-center gap-1 rounded-xl bg-black/30 px-2">
                    <button type="button" onClick={() => house.jump(index)}
                      aria-current={index === house.cursor ? "true" : undefined}
                      className={"min-h-11 min-w-0 flex-1 truncate px-1 text-left text-sm " +
                        (index === house.cursor ? "text-amber" : "text-[#e8dccf]")}>
                      {index === house.cursor ? "Now · " : (index + 1) + ". "}{song?.title ? cleanCatalogTrackNumber(song.title) : "Track"} · {sourceAlbum?.title}
                    </button>
                    <button type="button" onClick={() => house.moveQueue(index, -1)} disabled={index === 0}
                      aria-label={"Move queue song " + (index + 1) + " earlier"} className="min-h-11 min-w-11 disabled:opacity-30"><ArrowUp className="mx-auto" size={17} /></button>
                    <button type="button" onClick={() => house.moveQueue(index, 1)} disabled={index === house.queue.length - 1}
                      aria-label={"Move queue song " + (index + 1) + " later"} className="min-h-11 min-w-11 disabled:opacity-30"><ArrowDown className="mx-auto" size={17} /></button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#d5c3b2]">
              <Clock3 size={16} className="text-amber" aria-hidden="true" />
              <span>Sleep timer:</span>
              {[15, 30, 45].map((minutes) => (
                <button key={minutes} type="button" disabled={Boolean(house.embed)}
                  onClick={() => house.armSleep(minutes)}
                  className="min-h-10 rounded-full border border-white/20 px-3 disabled:opacity-40">{minutes}m</button>
              ))}
              {house.sleepAt > 0 && <button type="button" onClick={() => house.armSleep(0)}
                className="min-h-10 rounded-full border border-amber/50 px-3 text-amber">Cancel timer</button>}
              {house.embed && <span>Official Suno playback cannot be paused by this timer.</span>}
            </div>
          </section>
        </div>

        <section className="mbl-field-desk-panel mt-4 rounded-2xl border border-white/20 p-4 sm:p-5" aria-labelledby="desk-history-heading">
          <h2 id="desk-history-heading" className="font-display text-xl">Recently played here</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {history.length === 0 && <p className="text-sm text-[#d2c3b4]">No listening history yet on this browser.</p>}
            {history.slice(0, 8).map((item, i) => {
              const recentAlbum = albums.find((entry) => entry.id === item.albumId);
              return (
                <button key={item.albumId + "-" + item.index + "-" + i} type="button"
                  onClick={() => onPlay([item])}
                  className="min-h-11 max-w-[280px] truncate rounded-xl border border-white/20 bg-black/30 px-3 text-sm"
                  title={recentAlbum?.tracks[item.index]?.title}>
                  {recentAlbum?.tracks[item.index]?.title || "Track"} · {recentAlbum?.title || "Record"}
                </button>
              );
            })}
          </div>
        </section>
          </>
        )}
      </div>
    </section>
  );
}
