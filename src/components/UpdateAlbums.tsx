import { useState, type FormEvent } from "react";
import { ArrowUpRight, RefreshCw, X, WandSparkles } from "lucide-react";
import {
  autoReleaseDraft, buildReleaseDraft, normalizeReleaseUrl, releaseIssueUrl, type ReleaseProvider,
} from "@/lib/releaseSubmission";
import { SOUNDCLOUD_ALBUMS } from "@/lib/soundcloud";
import type { Album } from "@/lib/engine";

export function UpdateAlbums({ albums }: { albums: Album[] }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [quickUrl, setQuickUrl] = useState("");
  const [quickYear, setQuickYear] = useState(String(new Date().getFullYear()));
  const [provider, setProvider] = useState<ReleaseProvider>("soundcloud");
  const [url, setUrl] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [count, setCount] = useState("");
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState("");
  const [tracks, setTracks] = useState("");
  const [description, setDescription] = useState("");
  const [problem, setProblem] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState("");

  async function checkDeployed() {
    setChecking(true);
    setProblem("");
    try {
      const address = new URL(`${import.meta.env.BASE_URL}catalog/albums.json`, window.location.href);
      address.searchParams.set("check", String(Date.now()));
      const response = await fetch(address, { cache: "no-store" });
      if (!response.ok) throw new Error("Catalog unavailable.");
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !Array.isArray((data as { albums?: unknown }).albums)) {
        throw new Error("Published catalog is invalid.");
      }
      const count = (data as { albums: unknown[] }).albums.length;
      setCheckResult(`Published MBL catalog: ${count} Suno albums. This site's bundled SoundCloud archive has ${SOUNDCLOUD_ALBUMS.length} albums. If you released something new, submit the new link below to create a review request.`);
    } catch {
      setCheckResult("Couldn't check the published catalog right now. The existing music is unchanged.");
    } finally { setChecking(false); }
  }

  function submitQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem("");
    try {
      const draft = autoReleaseDraft(quickUrl, Number(quickYear));
      const isKnown = draft.provider === "soundcloud"
        ? SOUNDCLOUD_ALBUMS.some((album) => album.url === draft.url)
        : albums.some((album) => album.suno === draft.url);
      if (isKnown) throw new Error("Already in the MBL catalog. No duplicate import needed.");
      window.open(releaseIssueUrl(draft), "_blank", "noopener,noreferrer");
      setCheckResult(draft.provider === "soundcloud"
        ? "GitHub opened your one-link SoundCloud import request. Submit it as the repository owner. The Action verifies public title and artwork and prepares a review PR; song count is marked unverified until confirmed."
        : "GitHub opened your Suno album link request. Submit it as owner. Without an official verifiable album song listing, the workflow asks for song IDs rather than inventing an unplayable album.");
    } catch (error) { setProblem(error instanceof Error ? error.message : "Unsupported album link."); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem("");
    try {
      const normalized = normalizeReleaseUrl(provider, url);
      if (normalized && (provider === "soundcloud"
          ? SOUNDCLOUD_ALBUMS.some((album) => album.url === normalized)
          : albums.some((album) => album.suno === normalized))) {
        throw new Error("That album is already in the MBL catalog. No duplicate import needed.");
      }
      const draft = buildReleaseDraft({
        provider, url, year: Number(year), title, cover, description,
        trackCount: Number(count), tracks,
      });
      const link = releaseIssueUrl(draft);
      // GitHub's URL-query issue prefill has a practical length limit. For a
      // very large Suno album, fall back to a copied structured request.
      if (link.length > 5500) {
        throw new Error("This request is too long for a GitHub issue link. Submit fewer songs at once or use the importer in GitHub Actions.");
      }
      window.open(link, "_blank", "noopener,noreferrer");
      setCheckResult("GitHub opened your release request. Submit it while signed into your MichaelWave369 account. The owner-only workflow prepares a pull request for review; it is not published until you merge it.");
    } catch (error) { setProblem(error instanceof Error ? error.message : "Invalid release details."); }
  }

  return (
    <div className="mt-3" aria-label="Album update manager">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber/60 bg-surface px-4 text-sm font-semibold text-amber">
        <RefreshCw size={16} aria-hidden /> Update albums
      </button>
      {open && (
        <section className="mt-4 rounded-2xl border border-amber/40 bg-surface p-4 sm:p-5" aria-labelledby="album-update-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber">Owner update rail</p>
              <h2 id="album-update-heading" className="mt-1 font-display text-2xl">Bring your next release home</h2>
              <p className="mt-2 max-w-2xl text-sm text-mist">
                Update your public Vault and Timeline. GitHub Pages can't write its own album files, so the
                owner submits one verified release request and GitHub prepares a reviewable PR.
              </p>
            </div>
            <button type="button" className="min-h-11 min-w-11 rounded-full border border-line" onClick={() => setOpen(false)}
              aria-label="Close album updater"><X size={17} className="mx-auto" /></button>
          </div>
          <button type="button" disabled={checking} onClick={() => void checkDeployed()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm disabled:opacity-50">
            <RefreshCw size={15} aria-hidden /> {checking ? "Checking catalog…" : "Check published catalog"}
          </button>

          <form onSubmit={submitQuick} className="mt-5 rounded-xl border border-amber/30 bg-bg/50 p-4">
            <h3 className="flex items-center gap-2 font-display text-xl"><WandSparkles size={19} className="text-amber" /> Auto new album · One link</h3>
            <p className="mt-2 text-sm text-mist">Paste your public SoundCloud or Suno album link. We'll recognize the platform and send it to your owner-only GitHub review workflow.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_108px_auto] sm:items-end">
              <label className="min-w-0 text-sm text-mist">New album URL
                <input required type="url" value={quickUrl} onChange={(e) => setQuickUrl(e.target.value)}
                  placeholder="https://soundcloud.com/microneesia/sets/… or https://suno.com/album/…"
                  className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream" />
              </label>
              <label className="text-sm text-mist">Year
                <input required type="number" min={1990} max={2100} value={quickYear} onChange={(e) => setQuickYear(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream" />
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-heat px-4 font-semibold text-white">
                <WandSparkles size={17} /> Auto new album ↗
              </button>
            </div>
            <p className="mt-2 text-xs text-mist">
              SoundCloud: official title/artwork fetched automatically; track count remains unknown until verified.
              Suno: may require official song IDs to finish; no invented tracks or unauthorized scraping.
              Nothing goes live before you approve the catalog PR.
            </p>
          </form>
          {problem && <p role="alert" className="mt-3 text-sm text-heat">{problem}</p>}
          <button type="button" onClick={() => setManual((v) => !v)} aria-expanded={manual}
            className="mt-4 min-h-11 rounded-xl border border-line px-4 text-sm text-amber">
            {manual ? "Hide manual details" : "Manual details (for Suno songs or precise track counts)"}
          </button>
          {manual && (
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber">Music platform</legend>
              <div className="flex flex-wrap gap-2">
                {(["soundcloud", "suno"] as const).map((value) => (
                  <button key={value} type="button" onClick={() => { setProvider(value); setProblem(""); }}
                    aria-pressed={provider === value}
                    className={`min-h-11 rounded-full px-4 text-sm ${provider === value ? "bg-amber font-bold text-ink" : "border border-line text-mist"}`}>
                    {value === "suno" ? "Suno" : "SoundCloud"}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <label className="text-sm text-mist">Public album link
                <input required type="url" value={url} onChange={(event) => setUrl(event.target.value)}
                  placeholder={provider === "suno" ? "https://suno.com/album/…" : "https://soundcloud.com/microneesia/sets/…"}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream" />
              </label>
              <label className="text-sm text-mist">Release year
                <input required type="number" min={1990} max={2100} value={year} onChange={(event) => setYear(event.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream" />
              </label>
            </div>
            {provider === "soundcloud" ? (
              <label className="text-sm text-mist">Number of songs on this SoundCloud album
                <input required type="number" min={1} max={200} value={count} onChange={(event) => setCount(event.target.value)}
                  placeholder="e.g. 12" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream sm:max-w-48" />
                <span className="mt-1 block text-xs">The official SoundCloud player handles individual tracks; we fetch the album title and artwork from SoundCloud oEmbed during review.</span>
              </label>
            ) : (
              <>
                <label className="text-sm text-mist">New Suno album title
                  <input required value={title} onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream" />
                </label>
                <label className="text-sm text-mist">Public Suno album artwork URL
                  <input required type="url" value={cover} onChange={(event) => setCover(event.target.value)}
                    placeholder="https://cdn2.suno.ai/…" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream" />
                </label>
                <label className="text-sm text-mist">Tracks, one per line
                  <textarea required value={tracks} onChange={(event) => setTracks(event.target.value)}
                    placeholder={"Fractal Licious | c2ed2c5b-caa7-42ae-84f1-46d91e776efa\nNext song | https://suno.com/song/…"}
                    rows={5} className="mt-1 block w-full rounded-xl border border-line bg-bg p-3 font-mono text-xs text-cream" />
                  <span className="mt-1 block text-xs">Use Song title | Suno song UUID (or share link). The official Suno embed will play each track; direct audio isn't assumed.</span>
                </label>
              </>
            )}
            <label className="text-sm text-mist">Description (optional)
              <input value={description} maxLength={480} onChange={(event) => setDescription(event.target.value)}
                placeholder="A few words about this release" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-cream" />
            </label>

            <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-heat px-5 font-semibold text-white sm:justify-self-start">
              Prepare update on GitHub <ArrowUpRight size={17} aria-hidden />
            </button>
          </form>
          )}
          {checkResult && <p role="status" className="mt-4 text-sm text-amber">{checkResult}</p>}
          <p className="mt-4 text-xs text-mist">
            Only submissions from the repository owner can create catalog PRs. Nothing publishes without a merge.
            No Suno/SoundCloud credentials or private audio are exposed.
          </p>
        </section>
      )}
    </div>
  );
}
