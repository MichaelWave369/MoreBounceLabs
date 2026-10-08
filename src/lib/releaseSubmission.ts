/**
 * A static GitHub Pages site cannot write to its own public repository.
 * Release requests go through an authenticated GitHub issue, then an
 * owner-only CI workflow creates a reviewable catalog PR.
 */
export type ReleaseProvider = "soundcloud" | "suno";
export type ReleaseDraft = {
  kind: "mbl-release-v1";
  provider: ReleaseProvider;
  url: string;
  year: number;
  trackCount?: number;
  title?: string;
  cover?: string;
  description?: string;
  tracks?: { title: string; sunoId: string }[];
};
export const RELEASE_ISSUE_BASE = "https://github.com/MichaelWave369/MoreBounceLabs/issues/new";
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function normalizeReleaseUrl(provider: ReleaseProvider, input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (provider === "soundcloud") {
      if (url.hostname !== "soundcloud.com" ||
          !/^\/microneesia\/sets\/[a-z0-9-]+\/?$/.test(url.pathname)) return null;
      const pathname = url.pathname.replace(/\/$/, "");
      return "https://soundcloud.com" + pathname;
    }
    if (url.hostname !== "suno.com") return null;
    const match = /^\/album\/([a-f0-9-]{36})\/?$/i.exec(url.pathname);
    if (!match || !UUID.test(match[1])) return null;
    return "https://suno.com/album/" + match[1].toLowerCase();
  } catch {
    return null;
  }
}

export function parseSunoTracks(input: string): { title: string; sunoId: string }[] {
  return input.trim().split(/\r?\n/).filter(Boolean).map((row, i) => {
    const parts = row.split("|");
    if (parts.length !== 2) throw new Error(`Song ${i + 1}: use Title | Suno song UUID.`);
    const title = parts[0].trim();
    const raw = parts[1].trim();
    const id = raw.match(/^(?:https:\/\/suno\.com\/(?:song|s)\/)?([0-9a-f-]{36})\/?$/i)?.[1];
    if (!title || title.length > 140 || !id || !UUID.test(id)) {
      throw new Error(`Song ${i + 1}: check its title and valid Suno song UUID.`);
    }
    return { title, sunoId: id.toLowerCase() };
  });
}

export function buildReleaseDraft(fields: {
  provider: ReleaseProvider; url: string; year: number; title: string;
  cover: string; description: string; trackCount: number; tracks: string;
}): ReleaseDraft {
  const url = normalizeReleaseUrl(fields.provider, fields.url);
  if (!url) throw new Error("Use your public SoundCloud album/sets link or Suno album link.");
  const year = Number(fields.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new Error("Enter a valid release year.");
  }
  const description = fields.description.trim().slice(0, 480);
  if (fields.provider === "soundcloud") {
    if (!Number.isInteger(fields.trackCount) || fields.trackCount < 1 || fields.trackCount > 200)
      throw new Error("Enter the SoundCloud album's actual song count (1–200).");
    return { kind: "mbl-release-v1", provider: "soundcloud", url, year,
      trackCount: fields.trackCount, ...(description ? { description } : {}) };
  }
  const title = fields.title.trim();
  if (!title || title.length > 140) throw new Error("Enter your new Suno album title.");
  const cover = fields.cover.trim();
  try {
    const u = new URL(cover);
    if (u.protocol !== "https:" || !(u.hostname === "cdn2.suno.ai" || u.hostname === "cdn1.suno.ai" || u.hostname === "suno.com")) throw Error();
  } catch { throw new Error("Use a public Suno artwork URL (suno.com or cdn1/cdn2.suno.ai)."); }
  const tracks = parseSunoTracks(fields.tracks);
  if (!tracks.length || tracks.length > 100) throw new Error("Add 1–100 Suno songs in Title | Song UUID format.");
  if (new Set(tracks.map((t) => t.sunoId)).size !== tracks.length) throw new Error("Remove duplicate Suno song IDs.");
  return { kind: "mbl-release-v1", provider: "suno", url, year,
    title, cover, tracks, ...(description ? { description } : {}) };
}
export function releaseIssueUrl(draft: ReleaseDraft): string {
  const albumName = draft.title || draft.url.split("/").pop() || "New release";
  const params = new URLSearchParams({
    title: `MBL album update: ${albumName}`,
    body: `## MBL album update request\n\nI'm submitting a new ${draft.provider} release for review and publication.\n\n` +
      "```json\n" + JSON.stringify(draft, null, 2) + "\n```\n\n" +
      "Only repository-owner requests are processed automatically. A PR must be reviewed and merged before the public Vault changes.\n",
  });
  return RELEASE_ISSUE_BASE + "?" + params.toString();
}
