import { prisma } from '@/lib/prisma';
import { type PlanLimits } from '@/lib/plans';
import { checkUsage, effectivePlan } from '@/lib/usage';
import { isEpisodeContent, type EpisodeContent } from './episode';

type Verdict = { ok: true } | { ok: false; status: number; message: string };

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Most voiced characters the whole app may spend per month. This is the backstop that protects the voice balance. */
export function monthlyVoiceBudgetChars(): number {
  const n = Number(process.env.AUDIO_MONTHLY_CHARS);
  return Number.isFinite(n) && n > 0 ? n : 40_000;
}

export async function planOf(userId: string): Promise<PlanLimits> {
  return (await effectivePlan(userId)).plan;
}

async function usage(userId: string) {
  const since = startOfMonth();
  const rows = await prisma.studioAsset.findMany({
    where: { type: 'AUDIO', workspace: { userId } },
    select: { createdAt: true, content: true },
  });
  const episodes = rows.map((r) => ({ at: r.createdAt, c: isEpisodeContent(r.content) ? r.content : null }));
  const thisMonth = episodes.filter((e) => e.at >= since);
  return {
    stored: episodes.length,
    madeThisMonth: thisMonth.length,
    voicedMinutesThisMonth: thisMonth.reduce((n, e) => n + (e.c?.audioPath ? e.c.minutes : 0), 0),
    everVoiced: episodes.some((e) => e.c?.audioPath),
  };
}

/** May this student make another episode (a script) right now, and at this length? Monthly counts are metered in lib/usage.ts. */
export async function checkScriptAllowance(userId: string, tier: number): Promise<Verdict> {
  const [plan, used] = await Promise.all([planOf(userId), usage(userId)]);
  if (tier > plan.audio.maxEpisodeMinutes) {
    return { ok: false, status: 403, message: `${plan.label} includes audio overviews up to ${plan.audio.maxEpisodeMinutes} minutes. Choose a shorter length, or upgrade for longer ones.` };
  }
  if (used.stored >= plan.audio.storedEpisodes) {
    return { ok: false, status: 429, message: `You have ${used.stored} audio overviews saved, the most your plan keeps. Delete one you have finished with in Study to make room.` };
  }
  const metered = await checkUsage(userId, 'audio_script');
  return metered.ok ? { ok: true } : { ok: false, status: metered.status, message: metered.message };
}

/**
 * May this episode be voiced? The student needs voiced minutes (from the plan or credits) or a free taster, and the
 * app-wide monthly voice budget needs room. If not, the transcript still stands and the message says why.
 * `metered` says whether minutes should be counted once the voicing succeeds (a taster is not counted).
 */
export async function checkVoiceAllowance(userId: string, episode: EpisodeContent): Promise<Verdict & { metered?: boolean }> {
  const [plan, used] = await Promise.all([planOf(userId), usage(userId)]);

  const taster = plan.audio.voicedTasters > 0 && !used.everVoiced && episode.minutes <= 6;
  if (!taster) {
    const minutes = Math.ceil(episode.minutes);
    const allowed = await checkUsage(userId, 'audio_minute', minutes);
    if (!allowed.ok) {
      const lead = plan.audio.voicedMinutesPerMonth === 0 ? 'Voices are part of the paid plans.' : `This episode runs about ${minutes} minutes.`;
      return { ok: false, status: 402, message: `${lead} ${allowed.message} Your transcript is ready to read in the meantime.` };
    }
  }

  const since = startOfMonth();
  const all = await prisma.studioAsset.findMany({ where: { type: 'AUDIO', createdAt: { gte: since } }, select: { content: true } });
  const spent = all.reduce((n, r) => n + (isEpisodeContent(r.content) && r.content.audioPath ? r.content.charCount : 0), 0);
  if (spent + episode.charCount > monthlyVoiceBudgetChars()) {
    return { ok: false, status: 503, message: 'Voices are paused for the rest of this month because the audio budget has been used. Your transcript is ready to read, and voices come back on the 1st.' };
  }
  return { ok: true, metered: !taster };
}
