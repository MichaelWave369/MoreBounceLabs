import { useEffect, useRef } from "react";
import { getAudio } from "@/lib/engine";

const MODES = [
  "spectrum",
  "scope",
  "waveform",
  "galaxy",
  "kaleido",
  "tunnel",
  "mandala",
  "crt",
  "fluid",
  "signature",
] as const;

export const VIZ_MODES = MODES;

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freq = new Uint8Array(0);
let wave = new Uint8Array(0);
let hooked = false;

export function vizIsLive() {
  return hooked && !!analyser;
}

function arm() {
  if (hooked) return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    const node = ctx.createMediaElementSource(getAudio());
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    node.connect(analyser);
    analyser.connect(ctx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
    wave = new Uint8Array(analyser.fftSize);
    hooked = true;
  } catch {
    hooked = false;
  }
}

export function VizCanvas({ mode, reduced, onLive }: { mode: string; reduced: boolean; onLive?: (live: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scroll = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    let frame = 0;
    const quality = reduced || window.innerWidth < 700 ? 0.45 : 1;

    const draw = (t: number) => {
      frame = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      let bass = 0.2;
      if (analyser && hooked && !reduced) {
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(wave);
        bass = freq.slice(0, 6).reduce((a, b) => a + b, 0) / (6 * 255);
      }
      g.fillStyle = "rgba(16,14,12,0.35)";
      g.fillRect(0, 0, w, h);

      if (mode === "spectrum" || mode === "crt") {
        const n = Math.floor(48 * quality);
        for (let i = 0; i < n; i++) {
          const v = analyser && hooked ? freq[i] / 255 : 0.15 + 0.1 * Math.sin(t / 280 + i);
          g.fillStyle = `hsl(${28 + i * 2}, 80%, ${40 + v * 30}%)`;
          g.fillRect(i * (w / n), h - v * h * 0.9, w / n - 2, v * h * 0.9);
        }
        if (mode === "crt") {
          g.fillStyle = "rgba(0,0,0,0.18)";
          for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
        }
      } else if (mode === "scope" || mode === "waveform") {
        g.beginPath();
        g.strokeStyle = "#e4a04a";
        g.lineWidth = 2;
        const len = wave.length || 64;
        scroll.current = mode === "waveform" ? (scroll.current + 2) % w : 0;
        for (let i = 0; i < len; i++) {
          const x = ((i / len) * w + scroll.current) % w;
          const y = wave.length ? (wave[i] / 255) * h : h / 2 + Math.sin(i / 6 + t / 300) * 20;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      } else if (mode === "galaxy") {
        const count = Math.floor(70 * quality);
        for (let i = 0; i < count; i++) {
          const a = t / 800 + i;
          const r = (40 + (i % 20) * 8) * (0.6 + bass);
          g.fillStyle = `hsla(${30 + i * 4}, 90%, 60%, 0.8)`;
          g.beginPath();
          g.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a * 1.3) * r * 0.6, 1.5 + bass * 4, 0, Math.PI * 2);
          g.fill();
        }
      } else if (mode === "kaleido" || mode === "mandala") {
        g.save();
        g.translate(w / 2, h / 2);
        const slices = mode === "mandala" ? 8 : 6;
        for (let s = 0; s < slices; s++) {
          g.rotate((Math.PI * 2) / slices);
          g.beginPath();
          g.strokeStyle = `hsla(${20 + s * 30 + t / 40}, 85%, 60%, 0.85)`;
          g.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const v = analyser && hooked ? freq[i * 3] / 255 : 0.4;
            const rad = 20 + i * 16 + v * 40 + bass * 20;
            g.lineTo(Math.cos(i) * rad, Math.sin(i + t / 500) * rad * 0.5);
          }
          g.stroke();
        }
        g.restore();
      } else if (mode === "tunnel") {
        for (let i = 8; i > 0; i--) {
          const p = ((t / 400 + i) % 8) / 8;
          g.strokeStyle = `hsla(${18 + i * 20}, 90%, 55%, ${0.3 + p * 0.5})`;
          g.lineWidth = 3;
          g.strokeRect(w / 2 - p * w * 0.45, h / 2 - p * h * 0.45, p * w * 0.9, p * h * 0.9);
        }
      } else if (mode === "fluid") {
        for (let i = 0; i < 6; i++) {
          const x = w * (0.2 + 0.12 * i) + Math.sin(t / 500 + i) * 40;
          const y = h / 2 + Math.cos(t / 400 + i) * (20 + bass * 40);
          const rad = 30 + bass * 50 + i * 4;
          const grd = g.createRadialGradient(x, y, 4, x, y, rad);
          grd.addColorStop(0, "rgba(255,92,51,0.55)");
          grd.addColorStop(1, "rgba(228,160,74,0)");
          g.fillStyle = grd;
          g.beginPath();
          g.arc(x, y, rad, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.save();
        g.translate(w / 2, h / 2);
        for (let i = 0; i < 5; i++) {
          g.rotate(0.2 + bass);
          g.strokeStyle = i % 2 ? "#ff5c33" : "#e4a04a";
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(0, 0, 40 + i * 28 + bass * 36, 16 + i * 10, t / 800, 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();
      }
    };
    frame = requestAnimationFrame(draw);
    const onPlay = () => {
      arm();
      void ctx?.resume();
      onLive?.(vizIsLive());
    };
    const el = getAudio();
    el?.addEventListener("play", onPlay);
    if (el && !el.paused) onPlay();
    return () => {
      cancelAnimationFrame(frame);
      el?.removeEventListener("play", onPlay);
    };
  }, [mode, reduced, onLive]);

  return <canvas ref={ref} width={960} height={280} className="h-52 w-full rounded-2xl bg-bg sm:h-64" aria-hidden />;
}
