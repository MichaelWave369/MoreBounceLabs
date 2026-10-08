/**
 * MBL Mix Exchange v1: declarative, untrusted DJ set instructions.
 * No authority to operate audio devices, download streams or execute code.
 * User must click "Load & play" after inspecting an imported mix.
 */
export type MixTransition = "cut" | "fade" | "blend";
export type MixTrack = {
  albumId: string;
  index: number;
  transition: MixTransition;
  note?: string;
};
export type ExchangeMix = {
  format: "mbl-mix-v1";
  name: string;
  creator: { type: "agent" | "human"; name: string };
  description: string;
  tracks: MixTrack[];
};
export type CatalogAlbum = { id: string; title: string; tracks: { title: string }[] };
export type MixReview = { mix: ExchangeMix; missing: string[]; queue: { albumId: string; index: number }[] };
const MAX_TRACKS = 40;
const MAX_JSON = 18000;

function str(v: unknown, max: number, label: string): string {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new Error(label + " is missing or too long.");
  return v.trim();
}
export function validateMix(raw: unknown, catalog: readonly CatalogAlbum[]): MixReview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Mix must be a JSON object.");
  const v = raw as Record<string, unknown>;
  if (v.format !== "mbl-mix-v1") throw new Error("Expected an MBL Mix Exchange v1 document.");
  const name = str(v.name, 100, "Mix name");
  if (!v.creator || typeof v.creator !== "object" || Array.isArray(v.creator)) throw new Error("Creator required.");
  const c = v.creator as Record<string, unknown>;
  if (c.type !== "agent" && c.type !== "human") throw new Error("Creator type must be agent or human.");
  const creator = { type: c.type, name: str(c.name, 80, "Creator name") };
  if (typeof v.description !== "string" || v.description.length > 800) throw new Error("Description too long.");
  if (!Array.isArray(v.tracks) || v.tracks.length < 1 || v.tracks.length > MAX_TRACKS)
    throw new Error("Mix requires 1–40 catalog tracks.");
  const missing: string[] = [];
  const queue: { albumId: string; index: number }[] = [];
  const tracks: MixTrack[] = v.tracks.map((item: unknown, i: number) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid track " + (i + 1));
    const t = item as Record<string, unknown>;
    const albumId = str(t.albumId, 160, "Album ID");
    const index = t.index;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) > 200) throw new Error("Invalid track index.");
    if (t.transition !== "cut" && t.transition !== "fade" && t.transition !== "blend")
      throw new Error("Transition must be cut, fade or blend.");
    if (t.note !== undefined && (typeof t.note !== "string" || t.note.length > 240)) throw new Error("Invalid mix note.");
    const album = catalog.find((a) => a.id === albumId);
    if (album?.tracks[index as number]) queue.push({ albumId, index: index as number });
    else missing.push(albumId + " / song " + ((index as number) + 1));
    return { albumId, index: index as number, transition: t.transition as MixTransition,
      ...(t.note?.toString().trim() ? { note: t.note.toString().trim() } : {}) };
  });
  return { mix: { format: "mbl-mix-v1", name, creator, description: v.description, tracks },
    missing, queue };
}
export function queueMix(
  mix: ExchangeMix, catalog: readonly CatalogAlbum[],
): { albumId: string; index: number }[] {
  const review = validateMix(mix, catalog);
  if (review.missing.length) throw new Error("This mix references missing catalog tracks. Review before playback.");
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
  const raw = { format: "mbl-mix-v1", name, creator: { type: creatorType, name: creatorName },
    description: "A curated MoreBounceLabs listening set. Transitions are creative notes, not automated crossfades.",
    tracks: queue.slice(0, MAX_TRACKS).map((item) => ({ ...item, transition: "cut" })) };
  return validateMix(raw, catalog).mix;
}
