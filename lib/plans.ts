// What each plan includes. One file, so prices and limits can be tuned without touching feature code.
// Limits are monthly unless noted. They are set so that a user who hits every limit still roughly pays for
// themselves, and the average user leaves most of the price as margin. See the monetization notes for the maths.

export type PlanTier = 'FREE' | 'PRO' | 'X';

/** Everything that is counted. Each plan includes some of each per month; beyond that, credits pay for it. */
export type UsageKind = 'chat' | 'generate' | 'guide' | 'upload' | 'audio_script' | 'audio_minute';

/** Credits one unit costs once the monthly allowance is used up. About 1 credit is worth 8 naira of our cost. */
export const CREDIT_COST: Record<UsageKind, number> = {
  chat: 1,
  generate: 3,
  guide: 5,
  upload: 2,
  audio_script: 3,
  audio_minute: 10,
};

/** Plain-language names, singular and plural, for messages and the usage screen. */
export const USAGE_LABEL: Record<UsageKind, { one: string; many: string }> = {
  chat: { one: 'chat message', many: 'chat messages' },
  generate: { one: 'quiz, card set or slide deck', many: 'quizzes, card sets and slide decks' },
  guide: { one: 'study guide', many: 'study guides' },
  upload: { one: 'upload', many: 'uploads' },
  audio_script: { one: 'audio overview', many: 'audio overviews' },
  audio_minute: { one: 'voiced minute', many: 'voiced minutes' },
};

export type PlanLimits = {
  label: string;
  /** Monthly allowance for the counted actions that are not audio (audio is in the audio block). */
  included: Record<'chat' | 'generate' | 'guide' | 'upload', number>;
  /** Naira per month, for display and the pricing page. Billing is handled by the payment provider. */
  priceNgn: number;
  audio: {
    /** Minutes of voiced audio per month. Voices are the single biggest cost, so this is the tightest limit. */
    voicedMinutesPerMonth: number;
    /** Voiced episodes allowed once, ever (a free taster). */
    voicedTasters: number;
    /** Script-only episodes (transcript, no voices) per month. */
    transcriptsPerMonth: number;
    /** Longest episode, in minutes. */
    maxEpisodeMinutes: 5 | 10 | 15;
    /** Episodes kept in storage at once. The oldest must be deleted to make room for a new one. */
    storedEpisodes: number;
    /** Whether a long source may be split into a multi-part series. */
    series: boolean;
    /** Whether episodes can be downloaded for offline listening. */
    download: boolean;
  };
};

export const PLANS: Record<PlanTier, PlanLimits> = {
  FREE: {
    label: 'Free',
    priceNgn: 0,
    included: { chat: 15, generate: 1, guide: 0, upload: 3 },
    audio: { voicedMinutesPerMonth: 0, voicedTasters: 1, transcriptsPerMonth: 3, maxEpisodeMinutes: 5, storedEpisodes: 3, series: false, download: false },
  },
  PRO: {
    label: 'Pro',
    priceNgn: 3500,
    included: { chat: 120, generate: 10, guide: 4, upload: 15 },
    audio: { voicedMinutesPerMonth: 20, voicedTasters: 0, transcriptsPerMonth: 15, maxEpisodeMinutes: 10, storedEpisodes: 15, series: false, download: true },
  },
  X: {
    label: 'X',
    priceNgn: 15500,
    included: { chat: 500, generate: 40, guide: 15, upload: 60 },
    audio: { voicedMinutesPerMonth: 75, voicedTasters: 0, transcriptsPerMonth: 60, maxEpisodeMinutes: 15, storedEpisodes: 60, series: true, download: true },
  },
};

export function planFor(tier: string | null | undefined): PlanLimits {
  const key = (tier ?? 'FREE').toUpperCase();
  return PLANS[key === 'PRO' || key === 'X' ? key : 'FREE'];
}

/** How many of this action the plan includes each month. */
export function includedFor(plan: PlanLimits, kind: UsageKind): number {
  if (kind === 'audio_script') return plan.audio.transcriptsPerMonth;
  if (kind === 'audio_minute') return plan.audio.voicedMinutesPerMonth;
  return plan.included[kind];
}
