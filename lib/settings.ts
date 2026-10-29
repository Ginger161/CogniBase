import { prisma } from '@/lib/prisma';

// Live switches the owner can flip without a deploy. Stored in one AppSetting row and cached for a few seconds,
// because every metered action reads them.

export type Switches = {
  /** true means that feature is switched off for everyone. */
  off: { chat: boolean; generate: boolean; uploads: boolean; audio: boolean };
  /** Shown to students when something is off, so they know it is on purpose and temporary. */
  message: string;
};

export const DEFAULT_SWITCHES: Switches = {
  off: { chat: false, generate: false, uploads: false, audio: false },
  message: 'This is paused for a short while. Please try again soon.',
};

const KEY = 'switches';
const TTL_MS = 10_000;
let cache: { at: number; value: Switches } | null = null;

export async function getSwitches(): Promise<Switches> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULT_SWITCHES;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    const v = row?.value as Partial<Switches> | null;
    if (v) value = { off: { ...DEFAULT_SWITCHES.off, ...(v.off ?? {}) }, message: typeof v.message === 'string' && v.message ? v.message : DEFAULT_SWITCHES.message };
  } catch {
    // If the settings table is missing or unreachable, nothing is switched off.
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSwitches(next: Switches, userId: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value: next, updatedById: userId },
    create: { key: KEY, value: next, updatedById: userId },
  });
  cache = { at: Date.now(), value: next };
}
