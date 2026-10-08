import { useEffect, useState } from "react";
import { ClipboardCopy, Download, Link2, ListMusic, Save, ShieldCheck } from "lucide-react";
import {
  decodeMix, mixShareUrl, newMixFromQueue, queueMix, validateMix,
  type ExchangeMix, type MixReview,
} from "@/lib/mixExchange";
import { useHouse, type Album, type QueueItem } from "@/lib/engine";

const STORAGE = "mbl-approved-mixes-v1";
const MAX_SAVED = 20;

function downloadMix(mix: ExchangeMix) {
  const data = new Blob([JSON.stringify(mix, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.download = "mbl-mix-" + mix.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0,45) + ".json";
  anchor.href = url;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AgentMixStudio({ albums, onPlay }: { albums: Album[]; onPlay: (items: QueueItem[]) => void }) {
  const house = useHouse();
  const [mixName, setMixName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorType, setCreatorType] = useState<"agent" | "human">("human");
  const [importText, setImportText] = useState("");
  const [review, setReview] = useState<MixReview | null>(null);
  const [saved, setSaved] = useState<ExchangeMix[]>([]);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    try {
      const fromStorage: unknown = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      if (Array.isArray(fromStorage)) {
        const valid = fromStorage.slice(0, MAX_SAVED).flatMap((value: unknown) => {
          try { return [validateMix(value, albums).mix]; } catch { return []; }
        });
        setSaved(valid);
      }
    } catch { /* User may have cleared or blocked local storage. */ }
    const shared = new URL(window.location.href).searchParams.get("mix");
    if (shared) {
      try {
        const result = decodeMix(shared, albums);
        setReview(result);
        setMessage("Shared mix loaded for review only. Nothing has started playing.");
      } catch (e) { setMessage(e instanceof Error ? e.message : "Couldn't decode this mix link."); }
    }
  }, [albums]);

  function preview(raw: unknown) {
    setReview(null);
    setLink("");
    setMessage("");
    try {
      const next = validateMix(raw, albums);
      setReview(next);
      setMessage(next.ok
        ? "Mix validated. Review its tracks before you choose Play approved mix."
        : "UNPLAYABLE: " + next.errors.length + " catalog reference error(s). Repair the mix before saving, sharing, or playback.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Invalid mix plan."); }
  }

  function fromQueue() {
    try {
      const mix = newMixFromQueue(house.queue, mixName, creatorName, creatorType, albums);
      preview(mix);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Play some music first to build a mix."); }
  }

  function importMix() {
    if (importText.length > 18000) { setReview(null); setMessage("Mix JSON is too large (18 KB maximum)."); return; }
    try { preview(JSON.parse(importText)); }
    catch { setReview(null); setMessage("Invalid JSON. Paste an MBL Mix Exchange v1 plan."); }
  }

  function saveMix() {
    if (!review?.ok) { setMessage("This mix is unplayable and cannot be saved until all catalog references are fixed."); return; }
    const next = [review.mix, ...saved.filter((mix) => JSON.stringify(mix) !== JSON.stringify(review.mix))].slice(0, MAX_SAVED);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setSaved(next);
      setMessage("Mix saved to this browser. Download its JSON if you want a durable backup.");
    } catch { setMessage("Browser storage unavailable. Download the mix JSON to save it."); }
  }

  async function copyLink() {
    if (!review?.ok) { setMessage("Repair missing catalog tracks before sharing."); return; }
    try {
      const next = mixShareUrl(review.mix, window.location.href);
      setLink(next);
      await navigator.clipboard.writeText(next);
      setMessage("Share link copied. Opening it shows the mix for review, never automatic playback.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to copy. Use the link displayed below."); }
  }

  async function copyAgentInstructions() {
    const catalogUrl = new URL(import.meta.env.BASE_URL + "catalog/albums.json", window.location.origin).href;
    const manifestUrl = new URL(import.meta.env.BASE_URL + "agent/mix-manifest-v1.json", window.location.origin).href;
    const instructions = [
      "Make a creative listening mix for MoreBounceLabs using the public catalog: " + catalogUrl,
      "Agent contract and JSON Schema: " + manifestUrl,
      "Return ONLY a JSON object in MBL Mix Exchange v1 format:",
      JSON.stringify({ format: "mbl-mix-v1", name: "Your mix name",
        creator: { type: "agent", name: "Your agent name" }, description: "Vibe and arc",
        tracks: [{ albumId: "exact album id from catalog", index: 0, transition: "cut", note: "Why this works" }] }, null, 2),
      "Use only album IDs and zero-based track indexes that exist in the catalog.",
      "Valid transitions: cut, fade, blend. These are suggestions, NOT live auto-mixing commands.",
      "Optional, estimated annotations: BPM 30–300, key, energy 0–1, startAtSec >= 0. No estimates should be represented as measured catalog facts.",
      "Include albumTitle, artist and trackTitle as human-readable context alongside canonical albumId/index.",
      "1–40 tracks. No code, file URLs, private data, copyrighted audio uploads, or executable instructions.",
      "The human artist must review and approve playback before any queue changes.",
    ].join("\n\n");
    try { await navigator.clipboard.writeText(instructions); setMessage("Agent mix-making instructions copied. Paste them into Mr. FL or another agent."); }
    catch { setImportText(instructions); setMessage("Clipboard unavailable. Agent instructions are shown in the text area."); }
  }

  const selected = review?.mix;
  const valid = Boolean(review?.ok);
  return (
    <section className="mbl-field-desk-panel mt-4 rounded-2xl border border-fuchsia-400/40 p-4 sm:p-5"
      aria-labelledby="mix-studio-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-fuchsia-200">Human × agent collaboration · Mix Exchange v1</p>
          <h2 id="mix-studio-heading" className="mt-1 font-display text-2xl">Agent Mix Studio</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#e3d2c6]">
            Humans and agents can build a set, save it, exchange JSON or share a link. Every imported mix is checked against
            the MBL Suno catalog before you choose to play it. No agent receives hidden control of your browser or Backspin.
          </p>
        </div>
        <button type="button" onClick={() => void copyAgentInstructions()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-fuchsia-300/50 px-4 text-sm">
          <ClipboardCopy size={16} aria-hidden="true" /> Copy agent DJ instructions
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber">
        <span>Schema: <a className="underline" href={import.meta.env.BASE_URL + "agent/mix-schema-v1.json"} target="_blank" rel="noopener noreferrer">Mix Exchange v1</a></span>
        <span>·</span>
        <span>Manifest: <a className="underline" href={import.meta.env.BASE_URL + "agent/mix-manifest-v1.json"} target="_blank" rel="noopener noreferrer">Agent contract</a></span>
      </div>
      {message && <p role="status" className="mt-3 text-sm text-amber">{message}</p>}
      {review && (
        <div className="mt-5 rounded-xl border border-amber/40 bg-black/50 p-4" aria-label="Mix review">
          <div className="flex items-center gap-2 text-amber"><ShieldCheck size={19} />
            <h3 className="font-display text-xl">{selected?.name}</h3>
          </div>
          <p className="mt-1 text-xs text-[#d5c7b8]">Submitted by {selected?.creator.name} ({selected?.creator.type}) · {selected?.tracks.length} song placements</p>
          <p className="mt-2 text-sm">{selected?.description}</p>
          <ol className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {selected?.tracks.map((item, index) => {
              const album = albums.find((a) => a.id === item.albumId);
              const song = album?.tracks[item.index];
              const label = song?.title
                ? (/^\d+[.)]\s/.test(song.title) ? song.title : (index + 1) + ". " + song.title)
                : (index + 1) + ". Missing song";
              const unplayable = !album || !song;
              return (
                <li key={index} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <strong>{label} · {album?.title || item.albumId}</strong>
                  {unplayable && <span className="ml-2 rounded-full border border-rose-400/50 px-2 text-xs text-rose-200">Can't play</span>}
                  <span className="ml-2 text-xs text-fuchsia-200">Transition idea: {item.transition}</span>
                  {item.note && <p className="mt-1 text-xs text-[#d5c7b8]">{item.note}</p>}
                </li>
              );
            })}
          </ol>
          {!review.ok && <p role="alert" className="mt-3 rounded-lg border border-rose-400/40 p-3 text-sm text-rose-200">
            <strong>UNPLAYABLE MIX</strong> · {review.errors.map((issue) => issue.message).join("; ")}
          </p>}
          {review.warnings.length > 0 && <p className="mt-2 text-xs text-amber" role="status">
            {review.warnings.map((issue) => issue.message).join("; ")}
          </p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!valid} onClick={() => {
              if (!selected) return;
              try {
                onPlay(queueMix(selected, albums));
                setMessage("You approved the set. MBL selected its music queue. Press Play inside Suno for embedded tracks.");
              } catch (e) { setMessage(e instanceof Error ? e.message : "Cannot play this mix."); }
            }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-4 font-semibold text-ink disabled:opacity-40">
              <ListMusic size={16} /> Play approved mix
            </button>
            <button type="button" disabled={!valid} onClick={saveMix} className="min-h-11 rounded-xl border border-white/30 px-3 disabled:opacity-40"><Save size={16} className="mr-2 inline" />Save</button>
            <button type="button" disabled={!valid} onClick={() => selected && downloadMix(selected)} className="min-h-11 rounded-xl border border-white/30 px-3 disabled:opacity-40"><Download size={16} className="mr-2 inline" />Export JSON</button>
            <button type="button" disabled={!valid} onClick={() => void copyLink()} className="min-h-11 rounded-xl border border-white/30 px-3 disabled:opacity-40"><Link2 size={16} className="mr-2 inline" />Share link</button>
          </div>
          {link && <input aria-label="Mix share URL" readOnly value={link}
            className="mt-3 min-h-11 w-full rounded-lg border border-white/20 bg-black/40 px-3 text-xs" />}
        </div>
      )}
      <details className="mt-4 rounded-xl border border-white/20 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-fuchsia-200">Create a mix from my queue · Creator &amp; title</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-[#e0d4c8]">Set name
          <input value={mixName} onChange={(e) => setMixName(e.target.value)} maxLength={100}
            className="mt-1 block min-h-11 w-full rounded-xl border border-white/20 bg-black/40 px-3 text-cream" />
        </label>
        <label className="text-xs text-[#e0d4c8]">DJ / agent name
          <input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} maxLength={80}
            className="mt-1 block min-h-11 w-full rounded-xl border border-white/20 bg-black/40 px-3 text-cream" />
        </label>
        <label className="text-xs text-[#e0d4c8]">Creator
          <select value={creatorType} onChange={(e) => setCreatorType(e.target.value as "human" | "agent")}
            className="mt-1 block min-h-11 w-full rounded-xl border border-white/20 bg-black/80 px-3 text-cream">
            <option value="agent">Agent</option><option value="human">Human</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={fromQueue} className="min-h-11 rounded-xl bg-fuchsia-600 px-4 text-sm font-semibold text-white">
          Build mix from current queue
        </button>
        <button type="button" onClick={() => { setReview(null); setLink(""); setMessage(""); }}
          className="min-h-11 rounded-xl border border-white/30 px-4 text-sm">Clear preview</button>
      </div>

      </details>
      <label className="mt-5 block text-sm text-[#e4d3c9]">
        Import agent-created mix JSON
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
          rows={2} maxLength={18000} placeholder='Paste an MBL Mix Exchange v1 JSON document from your agent here'
          className="mt-1 block w-full rounded-xl border border-white/20 bg-black/50 p-3 font-mono text-xs text-cream" />
      </label>
      <button type="button" onClick={importMix} className="mt-2 min-h-11 rounded-xl border border-amber/60 px-4 text-sm">
        Review imported JSON
      </button>
      {saved.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">Saved mixes on this browser</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {saved.map((mix, index) => (
              <button key={index} type="button" onClick={() => preview(mix)}
                className="min-h-11 rounded-full border border-white/25 bg-black/30 px-3 text-xs">
                {mix.name} · {mix.creator.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-[#c9b8ad]">
        Mix Exchange v1 shares <strong>plans and catalog references, not audio or rendered recordings</strong>.
        Fade/blend are creative directions, not automated Suno crossfades. For live scratching or recorded output,
        load authorized local audio into Backspin ’96.
      </p>
    </section>
  );
}
