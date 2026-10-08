/** MBL guest visual-control protocol. Scene commands only; no audio/media API. */
export const LENS_URL = "https://michaelwave369.github.io/infinitylens369/";
export const LENS_ORIGIN = "https://michaelwave369.github.io";
export const BRIDGE_CHANNEL = "mbl-infinitylens-v1";
export const BRIDGE_VERSION = 1;
export const BRIDGE_MODES = [
  ["cosmic-drift", "Cosmic Drift"],
  ["kaleido-trip", "Kaleido Trip"],
  ["tunnel-bloom", "Tunnel Bloom"],
  ["acid-melt", "Acid Melt"],
  ["pixel-melt", "Pixel Melt"],
  ["black-hole-lens", "Black Hole Lens"],
  ["mandelbrot", "Mandelbrot"],
  ["julia", "Julia"],
] as const;
export const BRIDGE_PALETTES = [
  ["aurora-phi", "Aurora Φ"],
  ["abyss-cyan", "Abyss Cyan"],
  ["solar-ember", "Solar Ember"],
  ["violet-gold-duality", "Violet Gold"],
] as const;
const modes = new Set(BRIDGE_MODES.map(([value]) => value));
const palettes = new Set(BRIDGE_PALETTES.map(([value]) => value));

export type BridgeAction = "mode" | "palette" | "safe" | "reset";
export function bridgeHello() {
  return { channel: BRIDGE_CHANNEL, kind: "hello", version: BRIDGE_VERSION };
}
export function bridgeCommand(action: BridgeAction, value: string | undefined, requestId: string) {
  if (!/^mbl-[0-9]{1,12}$/.test(requestId)) return null;
  if (action === "mode" && !modes.has(value as typeof BRIDGE_MODES[number][0])) return null;
  if (action === "palette" && !palettes.has(value as typeof BRIDGE_PALETTES[number][0])) return null;
  if ((action === "safe" || action === "reset") && value !== undefined) return null;
  return { channel: BRIDGE_CHANNEL, kind: "command", action, ...(value === undefined ? {} : { value }), requestId };
}
export type BridgeReady = {
  channel: string;
  kind: "ready";
  version: number;
  mode: typeof BRIDGE_MODES[number][0];
  palette: typeof BRIDGE_PALETTES[number][0];
  modes: string[];
  palettes: string[];
};
export function isBridgeReady(data: unknown): data is BridgeReady {
  if (!data || typeof data !== "object") return false;
  const value = data as Record<string, unknown>;
  return value.channel === BRIDGE_CHANNEL && value.kind === "ready" && value.version === BRIDGE_VERSION
    && modes.has(value.mode as BridgeReady["mode"])
    && palettes.has(value.palette as BridgeReady["palette"])
    && Array.isArray(value.modes) && Array.isArray(value.palettes)
    && value.modes.every((mode: unknown) => typeof mode === "string" && modes.has(mode as BridgeReady["mode"]))
    && value.palettes.every((palette: unknown) => typeof palette === "string" && palettes.has(palette as BridgeReady["palette"]));
}
export function isBridgeAck(data: unknown): data is { channel: string; kind: "ack"; version: number; requestId: string; action: BridgeAction } {
  if (!data || typeof data !== "object") return false;
  const value = data as Record<string, unknown>;
  return value.channel === BRIDGE_CHANNEL && value.kind === "ack" && value.version === BRIDGE_VERSION
    && typeof value.requestId === "string" && /^mbl-[0-9]{1,12}$/.test(value.requestId)
    && (value.action === "mode" || value.action === "palette" || value.action === "safe" || value.action === "reset");
}
