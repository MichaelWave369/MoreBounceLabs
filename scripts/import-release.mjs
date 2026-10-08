#!/usr/bin/env node
/**
 * Owner-approved MBL release importer.
 * Invoked exclusively by GitHub Actions for an issue opened by the repo owner.
 * Pure parser/merge functions are exported so fixture tests never need network.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const soundcloudUrl = /^https:\/\/soundcloud\.com\/microneesia\/sets\/([a-z0-9-]+)$/;
const sunoUrl = /^https:\/\/suno\.com\/album\/([a-f0-9-]{36})$/i;
function ensure(value, message) {
  if (!value) throw new Error(message);
}
function text(value, label, max = 480) {
  ensure(typeof value === "string" && value.trim().length > 0 && value.trim().length <= max,
    label + " must be a nonempty string (max " + max + ").");
  return value.trim();
}

export function parseReleaseIssue(body) {
  ensure(typeof body === "string" && body.length < 20000 &&
    body.startsWith("## MBL album update request"), "Not an MBL release issue.");
  const match = body.match(/```json\s*([\s\S]*?)\s*```/);
  ensure(match && match[1].length < 12000, "Missing JSON release request block.");
  const item = JSON.parse(match[1]);
  ensure(item && item.kind === "mbl-release-v1", "Unsupported release protocol.");
  ensure(item.provider === "soundcloud" || item.provider === "suno", "Invalid provider.");
  ensure(Number.isInteger(item.year) && item.year >= 1990 && item.year <= 2100, "Invalid release year.");
  ensure(typeof item.url === "string" && item.url.length < 400, "Invalid release link.");
  const parsed = new URL(item.url);
  ensure(parsed.protocol === "https:" && !parsed.username && !parsed.password &&
    !parsed.search && !parsed.hash, "Release links must be canonical HTTPS URLs.");
  if (item.provider === "soundcloud") {
    ensure(soundcloudUrl.test(item.url), "Only public /microneesia/sets/ albums can be imported.");
    ensure(Number.isInteger(item.trackCount) && item.trackCount >= 1 && item.trackCount <= 200,
      "SoundCloud release requires an accurate track count.");
  } else {
    const id = sunoUrl.exec(item.url)?.[1];
    ensure(id && UUID.test(id), "Invalid Suno album UUID.");
    text(item.title, "Suno album title", 140);
    const cover = new URL(text(item.cover, "Suno cover URL", 500));
    ensure(cover.protocol === "https:" &&
      ["cdn1.suno.ai", "cdn2.suno.ai", "suno.com"].includes(cover.hostname) &&
      !cover.username && !cover.password, "Suno artwork must be an official HTTPS Suno URL.");
    ensure(Array.isArray(item.tracks) && item.tracks.length >= 1 && item.tracks.length <= 100,
      "Suno albums require 1–100 listed songs.");
    const seen = new Set();
    for (const track of item.tracks) {
      text(track?.title, "Suno track title", 140);
      ensure(typeof track?.sunoId === "string" && UUID.test(track.sunoId), "Invalid song UUID.");
      ensure(!seen.has(track.sunoId.toLowerCase()), "Duplicate Suno song UUID.");
      seen.add(track.sunoId.toLowerCase());
    }
  }
  if (item.description !== undefined) text(item.description, "Description", 480);
  return item;
}

export async function mergeRelease(sunoCatalog, soundcloudCatalog, item, loadSoundCloud) {
  const suno = structuredClone(sunoCatalog);
  const soundcloud = structuredClone(soundcloudCatalog);
  ensure(Array.isArray(suno.albums) && Array.isArray(soundcloud.albums), "Invalid local catalogs.");
  if (item.provider === "soundcloud") {
    const slug = soundcloudUrl.exec(item.url)[1];
    const id = "sc-" + slug;
    if (soundcloud.albums.some((album) => album.id === id || album.url === item.url)) {
      return { changed: false, suno, soundcloud, provider: item.provider };
    }
    const meta = await loadSoundCloud(item.url);
    ensure(meta && meta.provider_name === "SoundCloud", "SoundCloud oEmbed did not verify the album.");
    // When supplied, author_url must exactly match the artist's public profile.
    if (meta.author_url) {
      ensure(typeof meta.author_url === "string" &&
        /^https?:\/\/soundcloud\.com\/microneesia\/?$/.test(meta.author_url),
        "SoundCloud release does not belong to the configured MicTek profile.");
    }
    const title = text(meta.title, "SoundCloud album title", 200)
      .replace(/\s+by\s+MicTek\s*$/i, "").trim().slice(0, 140);
    const coverURL = new URL(text(meta.thumbnail_url, "SoundCloud artwork", 500));
    ensure(coverURL.protocol === "https:" &&
      /^i\d+\.sndcdn\.com$/.test(coverURL.hostname), "SoundCloud thumbnail host is not approved.");
    const description = typeof item.description === "string" ? item.description.trim() : "";
    soundcloud.albums.push({
      id, title, artist: "MicTek", year: item.year,
      trackCount: item.trackCount, description,
      url: item.url, cover: coverURL.toString(),
    });
    // Snapshot date signals this was reviewed, not an automatic feed claim.
    soundcloud.snapshotDate = new Date().toISOString().slice(0, 10);
  } else {
    const albumUUID = sunoUrl.exec(item.url)[1].toLowerCase();
    const id = "suno-" + albumUUID;
    if (suno.albums.some((album) => album.id === id || album.suno === item.url)) {
      return { changed: false, suno, soundcloud, provider: item.provider };
    }
    suno.albums.push({
      id, title: item.title.trim(), artist: "Mikey More Bounce",
      type: item.tracks.length > 6 ? "LP" : "EP",
      year: String(item.year), description: item.description?.trim() || "",
      cover: item.cover, suno: item.url,
      tracks: item.tracks.map(({ title, sunoId }) => ({ title: title.trim(), sunoId: sunoId.toLowerCase() })),
    });
  }
  return { changed: true, suno, soundcloud, provider: item.provider };
}

export async function oembedSoundCloud(url) {
  const endpoint = "https://soundcloud.com/oembed?format=json&url=" + encodeURIComponent(url);
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    redirect: "error", signal: AbortSignal.timeout(12000),
  });
  ensure(response.ok, "SoundCloud oEmbed could not verify this album (" + response.status + ").");
  const meta = await response.json();
  return meta;
}

async function main() {
  const issue = parseReleaseIssue(process.env.MBL_ISSUE_BODY || "");
  const directory = resolve(process.cwd());
  const sunoFile = resolve(directory, "public/catalog/albums.json");
  const soundcloudFile = resolve(directory, "src/data/soundcloud-albums.json");
  const suno = JSON.parse(readFileSync(sunoFile, "utf8"));
  const soundcloud = JSON.parse(readFileSync(soundcloudFile, "utf8"));
  const result = await mergeRelease(suno, soundcloud, issue, oembedSoundCloud);
  if (!result.changed) {
    console.log("ALREADY_PRESENT: This exact album already exists; leaving catalogs unchanged.");
    return;
  }
  writeFileSync(sunoFile, JSON.stringify(result.suno, null, 2) + "\n", "utf8");
  writeFileSync(soundcloudFile, JSON.stringify(result.soundcloud, null, 2) + "\n", "utf8");
  console.log("IMPORT_READY: Added " + issue.provider + " release for owner PR review.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("RELEASE_IMPORT_FAILED:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
