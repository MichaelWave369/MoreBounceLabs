import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildReleaseDraft, normalizeReleaseUrl, parseSunoTracks, releaseIssueUrl } from "../src/lib/releaseSubmission.ts";
import { mergeRelease, parseReleaseIssue } from "./import-release.mjs";

const suno = JSON.parse(readFileSync("public/catalog/albums.json", "utf8"));
const cloud = JSON.parse(readFileSync("src/data/soundcloud-albums.json", "utf8"));
const albumUUID = "b6e9b38a-8c52-4da4-9de1-4208a676c8d0";
const songUUID = "f3958d3d-24d1-4d45-bfd8-5181269dda4a";

test("release URLs are limited to the artist's public account and supported Suno album UUIDs", () => {
  assert.equal(normalizeReleaseUrl("soundcloud", "https://soundcloud.com/microneesia/sets/new-grooves?utm_source=share"),
    "https://soundcloud.com/microneesia/sets/new-grooves");
  assert.equal(normalizeReleaseUrl("suno", "https://suno.com/album/" + albumUUID), "https://suno.com/album/" + albumUUID);
  for (const bad of ["https://evil.com/microneesia/sets/fake", "http://soundcloud.com/microneesia/sets/insecure",
    "https://soundcloud.com/anotheruser/sets/new", "https://soundcloud.com/microneesia/albums",
    "https://soundcloud.com@evil.test/microneesia/sets/fake"]) {
    assert.equal(normalizeReleaseUrl("soundcloud", bad), null, bad);
  }
  assert.equal(normalizeReleaseUrl("suno", "https://suno.com/album/invalid"), null);
});

test("Suno song rows must be real IDs or official song links, with no arbitrary URLs", () => {
  assert.deepEqual(parseSunoTracks("Test Song | " + songUUID), [{ title: "Test Song", sunoId: songUUID }]);
  assert.deepEqual(parseSunoTracks("Test Song | https://suno.com/song/" + songUUID), [{ title: "Test Song", sunoId: songUUID }]);
  assert.throws(() => parseSunoTracks("Song | https://evil.test/" + songUUID), /check its title/);
  assert.throws(() => parseSunoTracks("Only title"), /Title \| Suno/);
});

test("site request is bounded, encoded and creates an owner-only GitHub issue", () => {
  const draft = buildReleaseDraft({ provider: "soundcloud", url: "https://soundcloud.com/microneesia/sets/new-grooves",
    year: 2026, trackCount: 8, title: "", cover: "", description: "New funky LP", tracks: "" });
  const link = new URL(releaseIssueUrl(draft));
  assert.equal(link.hostname, "github.com");
  assert.equal(link.pathname, "/MichaelWave369/MoreBounceLabs/issues/new");
  const parsed = parseReleaseIssue(link.searchParams.get("body"));
  assert.deepEqual(parsed, draft);
  assert.throws(() => buildReleaseDraft({provider:"soundcloud",url:draft.url,year:2026,trackCount:0,
    title:"",cover:"",description:"",tracks:""}), /actual song count/);
});

test("verified SoundCloud oEmbed creates an additive record without modifying either original catalog", async () => {
  const request = parseReleaseIssue(new URL(releaseIssueUrl(buildReleaseDraft({
    provider:"soundcloud",url:"https://soundcloud.com/microneesia/sets/next-release",
    year:2026,trackCount:5,title:"",cover:"",description:"Real tunes",tracks:"",
  }))).searchParams.get("body"));
  let lookups = 0;
  const loader = async () => {
    lookups++;
    return { provider_name:"SoundCloud", author_url:"https://soundcloud.com/microneesia",
      title:"Next Release by MicTek", thumbnail_url:"https://i1.sndcdn.com/artworks-test-123-t500x500.jpg" };
  };
  const next = await mergeRelease(suno, cloud, request, loader);
  assert.ok(next.changed);
  assert.equal(lookups, 1);
  assert.equal(next.soundcloud.albums.length, cloud.albums.length + 1);
  assert.equal(next.suno.albums.length, suno.albums.length);
  const added = next.soundcloud.albums.at(-1);
  assert.equal(added.title, "Next Release");
  assert.equal(added.trackCount, 5);
  assert.equal(added.artist, "MicTek");
  const duplicate = await mergeRelease(suno, next.soundcloud, request, loader);
  assert.equal(duplicate.changed, false);
  assert.equal(lookups, 1, "Duplicate must not refetch metadata");
  assert.equal(cloud.albums.length, 18, "Committed baseline remains unchanged");
});

test("Suno importer adds official-embed-only tracks, and rejects dangerous issue input", async () => {
  const request = buildReleaseDraft({
    provider:"suno",url:"https://suno.com/album/"+albumUUID,year:2026,
    title:"The Next Funk",cover:"https://cdn2.suno.ai/album-cover.jpeg",
    description:"Launch!",trackCount:0,tracks:"Official Groove | "+songUUID,
  });
  const parsed = parseReleaseIssue(new URL(releaseIssueUrl(request)).searchParams.get("body"));
  const next = await mergeRelease(suno, cloud, parsed, async () => { throw Error("SoundCloud should not be fetched"); });
  assert.ok(next.changed);
  assert.equal(next.suno.albums.length, suno.albums.length+1);
  const added = next.suno.albums.at(-1);
  assert.equal(added.tracks[0].sunoId, songUUID);
  assert.equal(added.tracks[0].src, undefined, "No fake CDN stream URL");
  assert.equal(added.suno, request.url);
  assert.throws(() => parseReleaseIssue("This is a normal public issue"), /Not an MBL/);
  assert.throws(() => parseReleaseIssue(releaseIssueUrl(request) + "garbage"), /Not an MBL/);
  assert.throws(() => parseReleaseIssue("## MBL album update request\n\n```json\n{\"kind\":\"mbl-release-v1\",\"provider\":\"soundcloud\",\"url\":\"https://soundcloud.com/other/sets/bad\",\"year\":2026,\"trackCount\":5}\n```"), /Only public/);
});

test("SoundCloud release verification refuses artists from unrelated profiles", async () => {
  const draft = buildReleaseDraft({
    provider:"soundcloud",url:"https://soundcloud.com/microneesia/sets/a-new-one",
    year:2026,trackCount:4,title:"",cover:"",description:"",tracks:"",
  });
  await assert.rejects(() => mergeRelease(suno, cloud, draft, async () => ({
    provider_name:"SoundCloud",author_url:"https://soundcloud.com/other",
    title:"Forged",thumbnail_url:"https://i1.sndcdn.com/artworks-123-t500x500.jpg",
  })), /does not belong/);
});
