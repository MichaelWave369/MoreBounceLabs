/** Presentation only: never alter the canonical catalog track title. */
export function cleanCatalogTrackNumber(title: string): string {
  return title.replace(/^\s*\d{1,3}[.)]\s+/, "").trim();
}
