import { useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, Disc3, Radio, Sparkles } from "lucide-react";
import type { Album } from "@/lib/engine";
import { SOUNDCLOUD_ALBUMS } from "@/lib/soundcloud";
import {
  buildTimeline, filterTimeline, groupTimeline, TIMELINE_ERAS,
  timelineYears, type TimelineEntry, type TimelineFilter,
} from "@/lib/timeline";

const FILTERS: { id: TimelineFilter; title: string }[] = [
  { id: "all", title: "All music" },
  { id: "soundcloud", title: "SoundCloud archive" },
  { id: "suno", title: "Suno releases" },
];

export function MusicTimeline({
  sunoAlbums, query, reduced,
  onOpenSuno, onOpenSoundCloud,
}: {
  sunoAlbums: Album[];
  query: string;
  reduced: boolean;
  onOpenSuno: (id: string) => void;
  onOpenSoundCloud: (id: string) => void;
}) {
  const [year, setYear] = useState<number | "all">("all");
  const [provider, setProvider] = useState<TimelineFilter>("all");

  const allEntries = useMemo(() => buildTimeline(sunoAlbums, SOUNDCLOUD_ALBUMS), [sunoAlbums]);
  const years = useMemo(() => timelineYears(allEntries), [allEntries]);
  const filtered = useMemo(() => filterTimeline(allEntries, { provider, year, query }), [allEntries, provider, year, query]);
  const grouped = useMemo(() => groupTimeline(filtered), [filtered]);
  const totalTracks = allEntries.reduce((sum, album) => sum + album.tracks, 0);
  const currentEra = TIMELINE_ERAS[year === "all" ? years[0] : year] ?? {
    title: "The musical field", subtitle: "A record of the music and the moments between.", glow: "#e4a04a",
  };
  const heroCovers = filtered.slice(0, 3);

  function open(entry: TimelineEntry) {
    if (entry.provider === "suno") onOpenSuno(entry.id);
    else onOpenSoundCloud(entry.id);
  }

  return (
    <section className="pb-10" aria-label="MBL music timeline">
      <div
        className={`timeline-cosmos relative overflow-hidden rounded-[2rem] border border-line px-5 py-8 sm:px-9 sm:py-10 ${reduced ? "timeline-cosmos-still" : ""}`}
        style={{ "--timeline-halo": currentEra.glow } as CSSProperties}
      >
        <div className="timeline-orbit timeline-orbit-one" aria-hidden="true" />
        <div className="timeline-orbit timeline-orbit-two" aria-hidden="true" />
        <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber">
              <Sparkles size={16} aria-hidden="true" /> MoreBounceLabs · Music through the years
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-5xl leading-[1.04] sm:text-6xl">
              Every record is a little universe.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-mist">
              Travel through the original SoundCloud years and the new Suno era.
              These are real releases, real covers, and links to the music you made along the way.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span><strong className="text-amber">{allEntries.length}</strong> releases</span>
              <span><strong className="text-amber">{years.length}</strong> years represented</span>
              <span><strong className="text-amber">{totalTracks}</strong> track placements</span>
            </div>
            <p className="mt-3 text-xs text-mist">
              Chronology is by release year. Precise day/month ordering is not asserted.
              Visual atmospheres are ambient, not analysis of streamed audio.
            </p>
          </div>
          <div className="relative mx-auto hidden h-60 w-72 items-center justify-center sm:flex" aria-hidden="true">
            {heroCovers.length ? heroCovers.map((album, index) => (
              <img key={album.id} src={album.cover} alt="" loading="lazy"
                className="timeline-floating-sleeve absolute aspect-square w-40 rounded-2xl border border-white/20 object-cover shadow-2xl"
                style={{ transform: `translate(${(index - 1) * 65}px, ${Math.abs(index - 1) * 15}px) rotate(${(index - 1) * 14}deg)`, zIndex: 3 - Math.abs(index - 1) }}
              />
            )) : (
              <Disc3 size={84} className="text-amber" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="Timeline filters">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-xs font-bold uppercase tracking-widest text-mist">Explore era</p>
          <button type="button" aria-pressed={year === "all"}
            className={`min-h-11 rounded-full px-4 text-sm ${year === "all" ? "bg-amber font-semibold text-ink" : "bg-raised text-cream"}`}
            onClick={() => setYear("all")}>All years</button>
          {years.map((value) => (
            <button key={value} type="button" aria-pressed={year === value}
              className={`min-h-11 rounded-full px-4 text-sm ${year === value ? "bg-amber font-semibold text-ink" : "bg-raised text-cream"}`}
              onClick={() => setYear(value)}>{value}</button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="mr-2 text-xs font-bold uppercase tracking-widest text-mist">Music source</p>
          {FILTERS.map((item) => (
            <button key={item.id} type="button" aria-pressed={provider === item.id}
              className={`min-h-11 rounded-full border px-4 text-sm ${provider === item.id ? "border-amber bg-amber/15 text-cream" : "border-line text-mist"}`}
              onClick={() => setProvider(item.id)}>{item.title}</button>
          ))}
        </div>
        <p className="mt-3 text-xs text-mist" aria-live="polite">
          Showing {filtered.length} of {allEntries.length} releases{query.trim() ? ` matching “${query.trim()}”` : ""}.
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-10 text-center text-mist">
          No releases match those filters. Try another year, source, or search.
        </div>
      ) : (
        <div className="relative mt-8 space-y-12">
          <div className="timeline-spine absolute bottom-0 left-4 top-4 hidden w-px sm:block" aria-hidden="true" />
          {grouped.map(({ year: groupYear, entries }) => {
            const era = TIMELINE_ERAS[groupYear] ?? {
              title: "The archive", subtitle: "Original releases from another chapter.", glow: "#e4a04a",
            };
            return (
              <section key={groupYear} className="relative sm:pl-12"
                style={{ "--timeline-halo": era.glow } as CSSProperties}
                aria-labelledby={`timeline-year-${groupYear}`}>
                <span className="timeline-dot absolute left-[10px] top-4 hidden h-3 w-3 rounded-full sm:block" aria-hidden="true" />
                <div className="timeline-era-banner rounded-2xl border border-line p-5 sm:p-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.17em] text-amber">Chapter {String(groupYear)}</p>
                      <h2 id={`timeline-year-${groupYear}`} className="mt-1 font-display text-3xl sm:text-4xl">
                        {groupYear || "Undated"} · {era.title}
                      </h2>
                      <p className="mt-2 max-w-xl text-sm text-mist">{era.subtitle}</p>
                    </div>
                    <p className="text-xs text-mist">{entries.length} album{entries.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {entries.map((album) => (
                    <button key={album.provider + ":" + album.id} type="button"
                      className="sleeve group flex flex-col rounded-2xl border border-line bg-surface p-2 text-left hover:border-amber/60 focus-visible:outline-2 focus-visible:outline-amber"
                      onClick={() => open(album)}
                      aria-label={`Open ${album.title} from ${album.year} on ${album.provider === "suno" ? "Suno" : "SoundCloud"}`}>
                      {album.cover ? (
                        <img src={album.cover} alt="" loading="lazy" referrerPolicy="no-referrer"
                          className="aspect-square w-full rounded-xl bg-raised object-cover" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center rounded-xl bg-raised">
                          <Disc3 size={40} className="text-amber" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber">
                          {album.provider === "suno" ? "Suno release" : "SoundCloud archive"}
                        </span>
                        <strong className="mt-1 font-display text-lg leading-tight">{album.title}</strong>
                        <span className="mt-2 text-xs text-mist">{album.artist} · {album.tracks} tracks</span>
                        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-cream">
                          {album.provider === "suno" ? "Open album" : "Listen in Vault"}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-12 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
        <Radio size={22} className="text-amber" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold">Every era has its own sound.</p>
          <p className="text-xs text-mist">
            Suno opens its album view. SoundCloud opens its official playlist in the Vault.
            Cross-platform autoplay and audio-reactive visuals aren't implied.
          </p>
        </div>
      </div>
    </section>
  );
}
