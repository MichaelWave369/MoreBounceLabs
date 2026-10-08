import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Keep the music house navigable even if a third-party widget or another
 * room throws during render/effect cleanup. Never display a totally blank page.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MoreBounceLabs encountered a recoverable app error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-cream">
        <div role="alert" className="w-full max-w-lg rounded-3xl border border-amber/50 bg-surface p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber">MoreBounceLabs · Recovery</p>
          <h1 className="mt-3 font-display text-3xl">The music house hit a snag.</h1>
          <p className="mt-4 text-sm text-mist">
            An embedded music player or room failed to close cleanly.
            Your album library is safe. Return to the Lobby to restart the interface.
          </p>
          <button
            type="button"
            className="mt-6 min-h-11 rounded-full bg-amber px-5 font-semibold text-ink"
            onClick={() => {
              window.location.hash = "#/lobby";
              window.location.reload();
            }}
          >
            Restore MoreBounceLabs
          </button>
        </div>
      </main>
    );
  }
}
