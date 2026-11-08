export const COMMONS_XR_CHANNEL = "phi.commons.backspin-xr.v1";
export const COMMONS_XR_VERSION = 1;

// A bounded command surface. No URLs, file paths, imports, secrets or arbitrary DOM IDs.
/** @param {{ channel?: unknown, version?: unknown, type?: unknown, deck?: unknown, value?: unknown } | null | undefined} message */
export function parseCommonsXRCommand(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  if (message.channel !== COMMONS_XR_CHANNEL || message.version !== COMMONS_XR_VERSION) return null;
  const { type, deck, value } = message;
  if (type === "hello" || type === "snapshot") return { type };
  if ((type === "play" || type === "cue" || type === "release") && (deck === "A" || deck === "B"))
    return { type, deck };
  if (type === "scratch" && (deck === "A" || deck === "B") && typeof value === "number" &&
      Number.isFinite(value) && value >= -4 && value <= 4) return { type, deck, value };
  if (type === "crossfade" && typeof value === "number" && Number.isFinite(value) &&
      value >= -1 && value <= 1) return { type, value };
  return null;
}

/**
 * @param {string} origin
 * @param {string} parentOrigin
 * @param {string} parentPath
 */
export function isTrustedCommonsParent(origin, parentOrigin, parentPath) {
  return origin === parentOrigin && parentPath.startsWith("/Infinite-Commons/");
}
