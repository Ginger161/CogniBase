import type { UsageKind } from '@/lib/plans';

// What one unit of each metered action costs us in naira. These are estimates from token counts and quoted
// prices (about 1,400 naira to the dollar), used for the margin numbers in the admin overview. Replace them
// with measured numbers once real token use is logged.
export const UNIT_COST_NGN: Record<UsageKind, number> = {
  chat: 22,
  generate: 42,
  guide: 70,
  upload: 100,
  audio_script: 42,
  audio_minute: 76,
};

/** Estimated naira cost of a set of usage counts. */
export function estimateCost(counts: Partial<Record<UsageKind, number>>): number {
  return (Object.keys(UNIT_COST_NGN) as UsageKind[]).reduce((sum, kind) => sum + (counts[kind] ?? 0) * UNIT_COST_NGN[kind], 0);
}
