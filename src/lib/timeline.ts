/**
 * The public MBL discography is grouped by verified release YEAR, not by
 * fabricated exact dates. SoundCloud entries are playlist embeds; Suno
 * entries are album routes. Neither provider's audio is copied here.
 */
export type TimelineProvider = "suno" | "soundcloud";
export type TimelineFilter = TimelineProvider | "all";

export type TimelineEntry = {
  id: string;
  title: string;
  artist: string;
  year: number;
  provider: TimelineProvider;
  cover: string;
  description: string;
  tracks: number;
};

type SunoRecord = {
  id: string;
  title: string;
  artist?: string;
  year?: string;
  cover?: string;
  description?: string;
  tracks: { title: string }[];
};
type SoundCloudRecord = {
  id: string;
  title: string;
  artist: string;
  year: number;
  cover: string;
  description: string;
  trackCount: number;
};

export const TIMELINE_ERAS: Record<number, { title: string; subtitle: string; glow: string }> = {
  2026: { title: "New dimensions", subtitle: "Suno experiments, new releases, and the next musical chapter.", glow: "#b85e48" },
  2025: { title: "Digital thresholds", subtitle: "The meeting place of instruments, ideas, and digital worlds.", glow: "#355da7" },
  2024: { title: "Signals from the mothership", subtitle: "Electronic expeditions, remixes, and comedic transmissions.", glow: "#90499c" },
  2023: { title: "Foundations & Boga Beatz", subtitle: "The early record shelves and the complete nine-volume Boga run.", glow: "#c28c38" },
  2022: { title: "Reflections", subtitle: "Original instrumentals and the roots of a larger musical universe.", glow: "#2d8d93" },
};

function releaseYear(value: string | number | undefined): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : 0;
}

export function buildTimeline(suno: readonly SunoRecord[], soundcloud: readonly SoundCloudRecord[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const album of suno) {
    entries.push({
      id: album.id, title: album.title, artist: album.artist || "Mikey More Bounce",
      year: releaseYear(album.year), provider: "suno", cover: album.cover || "",
      description: album.description || "", tracks: album.tracks.length,
    });
  }
  for (const album of soundcloud) {
    entries.push({
      id: album.id, title: album.title, artist: album.artist, year: releaseYear(album.year),
      provider: "soundcloud", cover: album.cover, description: album.description,
      tracks: album.trackCount,
    });
  }
  // Only known year-level chronology is guaranteed. Titles are deterministic
  // within a year; the order must NOT suggest unverified day/month dates.
  return entries.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export function timelineYears(entries: readonly TimelineEntry[]): number[] {
  return [...new Set(entries.map((entry) => entry.year))].sort((a, b) => b - a);
}

export function filterTimeline(
  entries: readonly TimelineEntry[],
  options: { provider: TimelineFilter; year: number | "all"; query: string },
): TimelineEntry[] {
  const search = options.query.trim().toLowerCase();
  return entries.filter((album) => {
    if (options.provider !== "all" && album.provider !== options.provider) return false;
    if (options.year !== "all" && album.year !== options.year) return false;
    if (!search) return true;
    const haystack = [album.title, album.artist, String(album.year), album.description, album.provider].join(" ").toLowerCase();
    return haystack.includes(search);
  });
}

export function groupTimeline(entries: readonly TimelineEntry[]): { year: number; entries: TimelineEntry[] }[] {
  return timelineYears(entries).map((year) => ({
    year, entries: entries.filter((album) => album.year === year),
  }));
}
