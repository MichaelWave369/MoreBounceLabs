/**
 * BackSpin96 performance-workspace policy.
 * Deliberately independent of audio state and side effects.
 * @typedef {"vinyl" | "console" | "studio"} WorkspaceMode
 */
export const WORKSPACE_MODES = Object.freeze(["vinyl", "console", "studio"]);
/** @param {unknown} value
 * @returns {WorkspaceMode}
 */
export function normalizeWorkspace(value) {
  return value === "console" || value === "studio" ? value : "vinyl";
}
/** @param {boolean} standalone
 * @param {WorkspaceMode} workspace
 * @param {boolean} expanded
 */
export function isOriginalRigVisible(standalone, workspace, expanded) {
  return standalone ? workspace === "studio" : expanded;
}
/** @param {{A?: {loaded?: boolean, playing?: boolean}, B?: {loaded?: boolean, playing?: boolean}} | null | undefined} snapshot */
export function hasMixInProgress(snapshot) {
  return Boolean(snapshot?.A?.loaded || snapshot?.B?.loaded ||
    snapshot?.A?.playing || snapshot?.B?.playing);
}
