/**
 * MBL Mix Exchange v1: strictly declarative, untrusted DJ set instructions.
 * A validated mix is never authority to load/play audio or change the DJ rig.
 */
export type MixTransition = "cut" | "fade" | "blend";
export type MixTrack = {
  albumId: string;
  index: number;
  transition: MixTransition;
  note?: string;
  albumTitle?: string;
  artist?: string;
  trackTitle?: string;
  bpm?: number;
  key?: string;
  energy?: number;
  startAtSec?: number;
};
export type ExchangeMix = {
  format: "mbl-mix-v1";
  name: string;
  creator: { type: "agent" | "human"; name: string };
  description: string;
  tracks: MixTrack[];
  /** Advisory export receipt; ALWAYS revalidate against the current catalog. */
  catalogWarnings?: MixValidationIssue[];
};
export type CatalogAlbum = { id: string; title: string; artist?: string; tracks: { title: string; duration?: number; bpm?: number; key?: string }[] };
export type MixValidationIssue = {
  code: "album_missing" | "track_missing" | "metadata_mismatch";
  trackIndex: number;
  albumId: string;
  message: string;
};
export type MixReview = {
  mix: ExchangeMix;
  ok: boolean;
  errors: MixValidationIssue[];
  warnings: MixValidationIssue[];
  missing: string[];
  queue: { albumId: string; index: number }[];
};
const MAX_TRACKS = 40;
const MAX_JSON = 18000;
const PROHIBITED_SCHEMES = /\b(?:file|javascript|data|vbscript)\s*:/i;

function str(v: unknown, max: number, label: string): string {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new Error(label + " is missing or too long.");
  return v.trim();
}
function metadataString(v: unknown, label: string, max: number): string | undefined {
  if (v === undefined) return undefined;
  return str(v, max, label);
}
function boundedNumber(v: unknown, label: string, min: number, max: number): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    throw new Error(label + " must be between " + min + " and " + max + ".");
  }
  return v;
}
export function validateMix(raw: unknown, catalog: readonly CatalogAlbum[]): MixReview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Mix must be a JSON object.");
  const v = raw as Record<string, unknown>;
  if (v.format !== "mbl-mix-v1") throw new Error("Expected an MBL Mix Exchange v1 document.");
  const name = str(v.name, 100, "Mix name");
  if (!v.creator || typeof v.creator !== "object" || Array.isArray(v.creator)) throw new Error("Creator required.");
  const c = v.creator as Record<string, unknown>;
  if (c.type !== "agent" && c.type !== "human") throw new Error("Creator type must be agent or human.");
  const creator: ExchangeMix["creator"] = { type: c.type as "agent" | "human", name: str(c.name, 80, "Creator name") };
  if (typeof v.description !== "string" || !v.description.trim()) {
    throw new Error("Description is missing. Describe the mix's journey or mood.");
  }
  if (v.description.length > 800) throw new Error("Description too long (800 characters maximum).");
  if (PROHIBITED_SCHEMES.test(v.description)) throw new Error("Description contains an unsupported file or script URL.");
  if (!Array.isArray(v.tracks) || v.tracks.length < 1 || v.tracks.length > MAX_TRACKS)
    throw new Error("Mix requires 1–40 catalog tracks.");

  const errors: MixValidationIssue[] = [];
  const warnings: MixValidationIssue[] = [];
  const missing: string[] = [];
  const queue: { albumId: string; index: number }[] = [];
  const tracks: MixTrack[] = v.tracks.map((item: unknown, i: number) => {
    const location = "Track " + (i + 1);
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(location + ": expected a track object.");
    const t = item as Record<string, unknown>;
    const albumId = str(t.albumId, 160, location + " album ID");
    if (t.albumId !== albumId) throw new Error(location + " (" + JSON.stringify(t.albumId) + "): albumId must match the catalog exactly; remove leading/trailing whitespace.");
    const context = location + " (" + albumId + ")";
    if (!Number.isInteger(t.index) || (t.index as number) < 0 || (t.index as number) > 200)
      throw new Error(context + ": invalid track index; use a zero-based integer between 0 and 200.");
    const index = t.index as number;
    if (t.transition !== "cut" && t.transition !== "fade" && t.transition !== "blend")
      throw new Error(context + ": transition must be cut, fade or blend.");
    if (t.note !== undefined && (typeof t.note !== "string" || t.note.length > 240))
      throw new Error(context + ": note must be at most 240 characters.");
    if (typeof t.note === "string" && PROHIBITED_SCHEMES.test(t.note))
      throw new Error(context + ": file and script URLs are not allowed in mix notes.");
    const albumTitle = metadataString(t.albumTitle, context + " album title", 200);
    const artist = metadataString(t.artist, context + " artist", 160);
    const trackTitle = metadataString(t.trackTitle, context + " track title", 200);
    const bpm = boundedNumber(t.bpm, context + " BPM", 30, 300);
    const key = metadataString(t.key, context + " musical key", 30);
    const energy = boundedNumber(t.energy, context + " energy", 0, 1);
    const startAtSec = boundedNumber(t.startAtSec, context + " start time", 0, 86400);
    const album = catalog.find((a) => a.id === albumId);
    if (!album) {
      errors.push({ code: "album_missing", trackIndex: i, albumId,
        message: context + ": album does not exist in the current MBL catalog." });
      missing.push(albumId + " / song " + (index + 1));
    } else if (!album.tracks[index]) {
      errors.push({ code: "track_missing", trackIndex: i, albumId,
        message: context + ": song " + (index + 1) + " is not on this album." });
      missing.push(albumId + " / song " + (index + 1));
    } else {
      queue.push({ albumId, index });
      if ((albumTitle && albumTitle !== album.title) || (trackTitle && trackTitle !== album.tracks[index].title)) {
        warnings.push({ code: "metadata_mismatch", trackIndex: i, albumId,
          message: context + ": readable title differs from the current catalog. The catalog identity takes priority." });
      }
    }
    return {
      albumId, index, transition: t.transition as MixTransition,
      ...(typeof t.note === "string" && t.note.trim() ? { note: t.note.trim() } : {}),
      ...(albumTitle ? { albumTitle } : {}),
      ...(artist ? { artist } : {}),
      ...(trackTitle ? { trackTitle } : {}),
      ...(bpm !== undefined ? { bpm } : {}),
      ...(key ? { key } : {}),
      ...(energy !== undefined ? { energy } : {}),
      ...(startAtSec !== undefined ? { startAtSec } : {}),
    };
  });
  return { mix: { format: "mbl-mix-v1", name, creator, description: v.description, tracks },
    ok: errors.length === 0, errors, warnings, missing, queue };
}
/**
 * Prepare a human-reviewed mix for saving, sharing or JSON download.
 * Never change the canonical albumId/index or silently replace a submitted
 * mismatched title. Fill *missing* readable values only; preserve warnings as
 * an advisory receipt that cannot grant playback permission.
 */
export function prepareMixForExport(mix: ExchangeMix, catalog: readonly CatalogAlbum[]): ExchangeMix {
  const review = validateMix(mix, catalog);
  if (!review.ok) throw new Error("Cannot export an unplayable mix: catalog references are missing.");
  const tracks = review.mix.tracks.map((item) => {
    const album = catalog.find((candidate) => candidate.id === item.albumId)!;
    const song = album.tracks[item.index]!;
    return {
      ...item,
      albumTitle: item.albumTitle || album.title,
      ...(album.artist ? { artist: item.artist || album.artist } : {}),
      trackTitle: item.trackTitle || song.title,
    };
  });
  return {
    ...review.mix, tracks,
    ...(review.warnings.length ? { catalogWarnings: review.warnings } : {}),
  };
}

export function queueMix(mix: ExchangeMix, catalog: readonly CatalogAlbum[]): { albumId: string; index: number }[] {
  const review = validateMix(mix, catalog);
  if (!review.ok) throw new Error("This mix references missing catalog tracks. Review before playback.");
  return review.queue;
}
export function encodeMix(mix: ExchangeMix): string {
  const bytes = new TextEncoder().encode(JSON.stringify(mix));
  if (bytes.length > MAX_JSON) throw new Error("Mix is too large to share as a URL. Export JSON instead.");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function decodeMix(value: string, catalog: readonly CatalogAlbum[]): MixReview {
  if (!/^[A-Za-z0-9_-]{1,24000}$/.test(value)) throw new Error("Invalid mix share link.");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  let binary: string;
  try { binary = atob(padded); } catch { throw new Error("Invalid encoded mix."); }
  if (binary.length > MAX_JSON) throw new Error("Mix exceeds the safe import size.");
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("Mix contains invalid JSON or text."); }
  return validateMix(parsed, catalog);
}
export function mixShareUrl(mix: ExchangeMix, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.hash = "#/desk";
  url.searchParams.set("mix", encodeMix(mix));
  if (url.href.length > 7600) throw new Error("Set is too long for a reliable share link. Export JSON instead.");
  return url.href;
}
export function newMixFromQueue(
  queue: readonly { albumId: string; index: number }[], name: string,
  creatorName: string, creatorType: "agent" | "human", catalog: readonly CatalogAlbum[],
): ExchangeMix {
  const raw = {
    format: "mbl-mix-v1", name, creator: { type: creatorType, name: creatorName },
    description: "A curated MoreBounceLabs listening set. Transitions are creative notes, not automated crossfades.",
    tracks: queue.slice(0, MAX_TRACKS).map((item) => {
      const album = catalog.find((a) => a.id === item.albumId);
      return {
        ...item, transition: "cut",
        ...(album ? { albumTitle: album.title, ...(album.artist ? { artist: album.artist } : {}), trackTitle: album.tracks[item.index]?.title } : {}),
      };
    }),
  };
  return validateMix(raw, catalog).mix;
}
