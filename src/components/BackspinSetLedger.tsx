import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, Flag, RotateCcw, ShieldAlert } from "lucide-react";
import {
  appendLedgerEvents,
  detectSetChanges,
  exportSetLedger,
  safeMarkerNote,
} from "../../scripts/backspin-set-ledger.mjs";

type Deck = { loaded: boolean; playing: boolean; title: string };
type Snapshot = {
  ready: boolean;
  A: Deck;
  B: Deck;
  crossfader: number;
};
type LedgerEntry = {
  id: number;
  at: string;
  elapsedSeconds: number;
  source: "OBSERVED" | "MANUAL";
  kind: string;
  detail: string;
  deck?: "A" | "B";
};

function clock(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return String(Math.floor(n / 60)).padStart(2, "0") + ":" +
    String(n % 60).padStart(2, "0");
}

export function BackspinSetLedger({ snapshot }: { snapshot: Snapshot }) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [includeTitles, setIncludeTitles] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const previous = useRef<Snapshot | null>(null);
  const nextId = useRef(1);
  const startMs = useRef(0);
  const startIso = useRef("");
  const endIso = useRef<string | null>(null);

  function stamped(source: LedgerEntry["source"], kind: string, detail: string, deck?: "A" | "B"): LedgerEntry {
    const now = Date.now();
    return {
      id: nextId.current++,
      at: new Date(now).toISOString(),
      elapsedSeconds: Math.max(0, Math.round((now - startMs.current) / 1000)),
      source,
      kind,
      detail,
      ...(deck ? { deck } : {}),
    };
  }

  useEffect(() => {
    if (!recording) return;
    const old = previous.current;
    previous.current = snapshot;
    if (!old) return;
    const changes = detectSetChanges(old, snapshot, includeTitles);
    if (changes.length === 0) return;
    const next = changes.map((change) => stamped(change.source, change.kind, change.detail, change.deck));
    setEntries((current) => appendLedgerEvents(current, next));
  }, [snapshot, recording, includeTitles]);

  function begin() {
    if (recording) return;
    if (!startIso.current) {
      startMs.current = Date.now();
      startIso.current = new Date(startMs.current).toISOString();
      nextId.current = 1;
    }
    endIso.current = null;
    previous.current = snapshot;
    const startEntry = stamped("MANUAL", "monitoring-started",
      entries.length ? "Set Ledger monitoring resumed by operator." : "Set Ledger monitoring started by operator.");
    setEntries((current) => appendLedgerEvents(current, [startEntry]));
    setRecording(true);
    setFeedback("Monitoring snapshots only. Recording actual audio is not enabled.");
  }

  function stop() {
    if (!recording) return;
    const stopEntry = stamped("MANUAL", "monitoring-stopped", "Set Ledger monitoring stopped by operator.");
    setEntries((current) => appendLedgerEvents(current, [stopEntry]));
    setRecording(false);
    previous.current = null;
    endIso.current = new Date().toISOString();
    setFeedback("Monitoring stopped. Export your ledger before closing this tab.");
  }

  function mark(kind: "transition" | "highlight" | "note") {
    if (!recording) return;
    const clean = safeMarkerNote(note);
    if (kind === "note" && !clean) {
      setFeedback("Write a note before adding a note marker.");
      return;
    }
    const label = kind === "transition" ? "Transition marker" :
      kind === "highlight" ? "Performance highlight" : "Operator note";
    const marker = stamped("MANUAL", kind, clean ? label + ": " + clean : label);
    setEntries((current) => appendLedgerEvents(current, [marker]));
    setNote("");
    setFeedback("Manual marker added.");
  }

  function clear() {
    if (entries.length && !window.confirm("Clear this Set Ledger? Export first if you want to keep the current timeline.")) return;
    setRecording(false);
    setEntries([]);
    setNote("");
    previous.current = null;
    nextId.current = 1;
    startMs.current = 0;
    startIso.current = "";
    endIso.current = null;
    setFeedback("Ledger cleared on this device.");
  }

  function download() {
    if (!entries.length || !startIso.current) return;
    const serialized = exportSetLedger(entries, {
      startedAt: startIso.current,
      endedAt: recording ? undefined : endIso.current ?? undefined,
      tracksIncluded: includeTitles,
    });
    const blob = new Blob([serialized], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "backspin96-set-ledger-" + startIso.current.slice(0, 19).replace(/[:T]/g, "-") + ".json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("Ledger download requested. Save the JSON somewhere you control.");
  }

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-fuchsia-500/35 bg-[#170e20]"
      aria-label="BackSpin96 private set ledger">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-fuchsia-200">
            <BookOpen size={18} aria-hidden="true" /> Set Ledger · Private Mix Timeline
          </p>
          <p className="mt-1 text-xs text-mist">
            {recording ? "Monitoring deck snapshots" : "Not monitoring"} ·
            {" "}{entries.length} events saved in memory · No actual audio recording
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)}
          aria-expanded={open} aria-controls="backspin-set-ledger-details"
          className="min-h-11 rounded-xl border border-fuchsia-400/40 bg-fuchsia-950/30 px-4 text-sm text-fuchsia-100">
          {open ? "Hide ledger" : "Open set ledger"}
        </button>
      </div>
      {open && (
        <div id="backspin-set-ledger-details" className="border-t border-fuchsia-500/25 p-4">
          <p className="mb-3 flex items-start gap-2 text-xs text-mist">
            <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            Opt-in only. Records approximate changes from the existing DJ engine's status
            every 650ms. No songs, sound, recordings, device IDs or passwords are captured.
            Optional track names and any notes you type appear only in your local ledger and export.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-mist">
              <input type="checkbox" checked={includeTitles} disabled={entries.length > 0}
                onChange={(event) => setIncludeTitles(event.target.checked)}
                className="h-4 w-4 accent-fuchsia-400 disabled:opacity-40" />
              Include track names in new log (optional)
            </label>
            {!recording ? (
              <button type="button" onClick={begin}
                className="min-h-11 rounded-xl bg-fuchsia-600 px-4 text-sm font-semibold text-white">
                {entries.length ? "Resume monitoring" : "Start set ledger"}
              </button>
            ) : (
              <button type="button" onClick={stop}
                className="min-h-11 rounded-xl border border-amber/60 bg-amber/10 px-4 text-sm text-cream">
                Stop monitoring
              </button>
            )}
            <button type="button" onClick={download} disabled={!entries.length}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm text-cream disabled:opacity-40">
              <Download size={16} aria-hidden="true" /> Export JSON
            </button>
            <button type="button" onClick={clear} disabled={!entries.length && !recording}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm text-mist disabled:opacity-40">
              <RotateCcw size={15} aria-hidden="true" /> Clear
            </button>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="text-xs text-mist">
              Optional manual marker note (120 characters maximum)
              <input type="text" value={note} maxLength={120} disabled={!recording}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Crowd reaction, transition idea, or moment…"
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-[#100b19] px-3 text-sm text-cream disabled:opacity-50" />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button type="button" disabled={!recording} onClick={() => mark("transition")}
                className="min-h-11 rounded-xl border border-line px-3 text-sm text-mist disabled:opacity-40">Transition</button>
              <button type="button" disabled={!recording} onClick={() => mark("highlight")}
                className="min-h-11 rounded-xl border border-line px-3 text-sm text-mist disabled:opacity-40">Highlight</button>
              <button type="button" disabled={!recording} onClick={() => mark("note")}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-fuchsia-400/50 px-3 text-sm text-fuchsia-100 disabled:opacity-40">
                <Flag size={15} aria-hidden="true" /> Note
              </button>
            </div>
          </div>
          {feedback && <p role="status" className="mb-3 text-xs text-fuchsia-200">{feedback}</p>}
          <div className="rounded-xl border border-line bg-[#100b19] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-cream">Timeline</h2>
              <p className="text-xs text-mist">Latest 12 shown · keeps most recent 1,000</p>
            </div>
            {entries.length ? (
              <ol className="grid gap-2" aria-label="Recent set events">
                {[...entries].reverse().slice(0, 12).map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 rounded-lg border border-line p-2 text-xs">
                    <span className="shrink-0 font-mono text-cyan-200">{clock(entry.elapsedSeconds)}</span>
                    <span>
                      <span className="mr-2 font-semibold text-cream">{entry.source}</span>
                      <span className="text-mist">{entry.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-xs text-mist">No events yet. Monitoring is off until you explicitly start it.</p>}
          </div>
          <p className="mt-3 text-xs text-mist">
            Browser tab reloads discard unsaved entries. Export before leaving. Observed timestamps
            are snapshots, not accurate beat grids or proof of sound from your speakers.
          </p>
        </div>
      )}
    </section>
  );
}
