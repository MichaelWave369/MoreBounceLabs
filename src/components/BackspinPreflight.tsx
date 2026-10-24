import { useState } from "react";
import { CheckCircle2, ClipboardCheck, ClipboardCopy, RotateCcw, ShieldAlert } from "lucide-react";
import {
  assessPreflight,
  makeSoundcheckReport,
  MANUAL_SOUNDCHECK,
  summarizePreflight,
} from "../../scripts/backspin-preflight.mjs";

type Snapshot = {
  ready: boolean;
  A: { loaded: boolean };
  B: { loaded: boolean };
};

export function BackspinPreflight({
  manifestStatus,
  bridgeReady,
  snapshot,
}: {
  manifestStatus: "checking" | "ready" | "missing";
  bridgeReady: boolean;
  snapshot: Snapshot;
}) {
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState<ReadonlySet<string>>(() => new Set());
  const [copyStatus, setCopyStatus] = useState("");

  const observed = assessPreflight({
    manifestStatus,
    bridgeReady,
    snapshot,
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    audioWorkletSupported: typeof window !== "undefined" &&
      "AudioContext" in window && "AudioWorkletNode" in window,
  });
  const summary = summarizePreflight(observed, completed);
  const overallLabel = summary.complete
    ? "Operator marked complete"
    : summary.status === "needs-attention"
      ? "Needs attention"
      : "Not fully checked";

  function toggle(id: string, checked: boolean) {
    setCompleted((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setCopyStatus("");
  }

  async function copyReport() {
    const report = makeSoundcheckReport(observed, completed, new Date().toISOString());
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Report copied locally. No audio files or track titles included.");
    } catch {
      setCopyStatus("Clipboard unavailable. Browser permission may be required.");
    }
  }

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-cyan-500/35 bg-[#0e1820]"
      aria-label="BackSpin96 DJ preflight soundcheck">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
            <ClipboardCheck size={18} aria-hidden="true" /> Preflight Soundcheck
          </p>
          <p className="mt-1 text-xs text-mist">
            {overallLabel} · Browser and engine {summary.observedPass}/{summary.observedTotal} ·
            Hands-on checks {summary.manualPass}/{summary.manualTotal}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)}
          aria-expanded={open} aria-controls="backspin-preflight-details"
          className="min-h-11 rounded-xl border border-cyan-400/40 bg-cyan-950/35 px-4 text-sm text-cyan-100">
          {open ? "Hide soundcheck" : "Open soundcheck"}
        </button>
      </div>
      {open && (
        <div id="backspin-preflight-details" className="border-t border-cyan-500/25 px-4 pb-4 pt-4">
          <p className="mb-4 flex items-start gap-2 text-xs text-cyan-100">
            <ShieldAlert size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
            Detected API support and engine state are not proof of sound at your speakers.
            You must personally test the full output path. Nothing here starts audio, records, or accesses music files.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-bold text-cream">Observed software checks</h2>
              <div className="grid gap-2">
                {observed.map((check) => (
                  <div key={check.id} className="rounded-xl border border-line bg-[#151c23] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-cream">{check.label}</span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                        check.state === "pass"
                          ? "bg-emerald-900/50 text-emerald-200"
                          : check.state === "attention"
                            ? "bg-rose-900/60 text-rose-100"
                            : "bg-[#29323c] text-mist"
                      }`}>
                        {check.state === "pass" ? "Detected" : check.state === "attention" ? "Attention" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-mist">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold text-cream">Hands-on DJ checks</h2>
              <p className="mb-3 text-xs text-mist">
                These checkmarks are your own confirmation for this open session.
                They reset when the rig reloads, rather than pretending yesterday's soundcheck is still valid.
              </p>
              <div className="grid gap-2">
                {MANUAL_SOUNDCHECK.map((item) => (
                  <label key={item.id} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border border-line bg-[#151c23] p-3">
                    <input type="checkbox" checked={completed.has(item.id)}
                      onChange={(event) => toggle(item.id, event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
                      aria-label={item.label} />
                    <span>
                      <span className="block text-sm font-semibold text-cream">{item.label}</span>
                      <span className="mt-1 block text-xs text-mist">{item.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyReport()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/50 px-4 text-sm text-cyan-100">
                  <ClipboardCopy size={16} aria-hidden="true" /> Copy local report
                </button>
                <button type="button" disabled={completed.size === 0}
                  onClick={() => { setCompleted(new Set()); setCopyStatus(""); }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm text-mist disabled:opacity-40">
                  <RotateCcw size={15} aria-hidden="true" /> Clear manual checks
                </button>
              </div>
              {copyStatus && <p className="mt-2 text-xs text-mist" role="status">{copyStatus}</p>}
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-mist" role="status">
            {summary.complete && <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-emerald-300" />}
            {summary.complete
              ? "All listed software signals pass and you marked the manual checks complete. Actual audio quality remains your responsibility."
              : "Soundcheck is incomplete. Complete the software setup and personally verify each output before relying on the booth."}
          </p>
        </div>
      )}
    </section>
  );
}
