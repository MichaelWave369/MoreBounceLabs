import { createRoot } from "react-dom/client";
import { BackspinDecks } from "./components/BackspinDecks";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Backspin96 needs a #root element to render.");
}

const home = import.meta.env.BASE_URL;

createRoot(root).render(
  <AppErrorBoundary>
    <div className="min-h-screen bg-bg text-cream">
      <header className="border-b border-line bg-bg/95">
        <div className="mx-auto flex max-w-[1760px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber">Independent DJ performance space</p>
            <p className="font-display text-2xl tracking-tight">Backspin96</p>
          </div>
          <a href={home} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm">
            MoreBounceLabs ↗
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[1760px] px-4 py-6">
        <BackspinDecks standalone />
      </main>
      <footer className="mx-auto max-w-[1760px] px-4 pb-8 text-xs text-mist">
        Backspin96 loads local audio only when you choose it. Mixing and playback remain under your control.
      </footer>
    </div>
  </AppErrorBoundary>,
);
