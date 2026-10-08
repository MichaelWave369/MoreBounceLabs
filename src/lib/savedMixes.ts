import type { ExchangeMix } from "@/lib/mixExchange";

export const MAX_LOCAL_MIXES = 20;

/**
 * Browser-local mix identity is creator + name. A second Save updates the
 * existing set instead of making identical-looking chips. Distinct creators
 * may publish differently authored sets under the same title.
 */
export function savedMixKey(mix: ExchangeMix): string {
  const normalize = (text: string) => text.trim().normalize("NFKC").toLocaleLowerCase("en");
  return [mix.creator.type, normalize(mix.creator.name), normalize(mix.name)].join("\u0000");
}
export function dedupeSavedMixes(mixes: readonly ExchangeMix[], limit = MAX_LOCAL_MIXES): ExchangeMix[] {
  const keys = new Set<string>();
  const result: ExchangeMix[] = [];
  for (const mix of mixes) {
    const key = savedMixKey(mix);
    if (keys.has(key)) continue;
    keys.add(key);
    result.push(mix);
    if (result.length >= limit) break;
  }
  return result;
}
export function upsertSavedMix(mix: ExchangeMix, existing: readonly ExchangeMix[]): {
  mixes: ExchangeMix[];
  updated: boolean;
} {
  const key = savedMixKey(mix);
  const updated = existing.some((previous) => savedMixKey(previous) === key);
  return { mixes: dedupeSavedMixes([mix, ...existing.filter((previous) => savedMixKey(previous) !== key)]), updated };
}
