import { validateMix, type CatalogAlbum, type MixValidationIssue } from "@/lib/mixExchange";

export type AgentValidation = {
  ok: boolean;
  errors: Array<MixValidationIssue | { code: "invalid_mix"; trackIndex: null; albumId: null; message: string }>;
  warnings: MixValidationIssue[];
  queue: { albumId: string; index: number }[];
  tracks: Array<{ trackIndex: number; albumId: string; song: string; album: string; playable: boolean }>;
};

type ReadOnlyMixApi = Readonly<{
  version: "mbl-mix-v1";
  validate: (input: unknown) => AgentValidation;
  preview: (input: unknown) => AgentValidation;
}>;

declare global {
  interface Window { mblMix?: ReadOnlyMixApi }
}

/**
 * Public, read-only agent helper. It never invokes the music engine, writes
 * localStorage, opens a network socket or executes instructions from a mix.
 * Every call validates references against the deployed public catalog.
 */
export function installReadOnlyMixApi(catalog: readonly CatalogAlbum[]): () => void {
  function inspect(input: unknown): AgentValidation {
    try {
      const encoded = typeof input === "string" ? input : JSON.stringify(input);
      if (typeof encoded !== "string" || encoded.length > 18000)
        throw new Error("Mix exceeds the 18 KB agent validation limit.");
      const raw: unknown = typeof input === "string" ? JSON.parse(input) : input;
      const review = validateMix(raw, catalog);
      return {
        ok: review.ok,
        errors: review.errors,
        warnings: review.warnings,
        queue: review.ok ? review.queue : [],
        tracks: review.mix.tracks.map((t, trackIndex) => {
          const album = catalog.find((a) => a.id === t.albumId);
          const song = album?.tracks[t.index];
          return { trackIndex, albumId: t.albumId, song: song?.title || t.trackTitle || "",
            album: album?.title || t.albumTitle || "", playable: Boolean(song) };
        }),
      };
    } catch (e) {
      return { ok: false, errors: [{ code: "invalid_mix", trackIndex: null, albumId: null,
        message: e instanceof Error ? e.message : "Unable to validate mix." }],
        warnings: [], queue: [], tracks: [] };
    }
  }
  const api: ReadOnlyMixApi = Object.freeze({
    version: "mbl-mix-v1" as const,
    validate: inspect,
    preview: inspect,
  });
  Object.defineProperty(window, "mblMix", { value: api, configurable: true, writable: false });
  return () => { if (window.mblMix === api) delete window.mblMix; };
}
