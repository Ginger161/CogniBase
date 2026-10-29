// The shapes an audio overview can take. Rotating them keeps episodes from sounding the same,
// and each one is built on a different learning technique.

export type AudioFormat = 'walkthrough' | 'quiz' | 'story' | 'myth' | 'coach' | 'rapid';
export type AudioGoal = 'learn' | 'lock' | 'cram';
export type LengthTier = 5 | 10 | 15;

export const FORMAT_INFO: Record<AudioFormat, { label: string; blurb: string; structure: string }> = {
  walkthrough: {
    label: 'Walkthrough',
    blurb: 'A teacher and a curious student take you through it.',
    structure:
      'A leads as the teacher; B is the curious student who asks the "wait, so..." questions and restates ideas in plain words. Move through the source in the order a learner needs it, one idea at a time, each with an example.',
  },
  quiz: {
    label: 'Quiz battle',
    blurb: 'The hosts quiz each other, and you answer first.',
    structure:
      'A and B take turns quizzing each other on the source. For each question the asker poses it, then there is a recall pause, then the answerer replies and the asker explains why. Mix easy warm-ups with harder application questions. Finish with a score recap.',
  },
  story: {
    label: 'Story mode',
    blurb: 'A scenario carries the ideas, so they stick.',
    structure:
      'Build the episode around one concrete scenario or case that walks through the concepts in order, with A narrating and B reacting and asking what happens next. Each concept appears as something that happens in the story, then is named and defined plainly.',
  },
  myth: {
    label: 'Myth-busting',
    blurb: 'Common wrong ideas versus the right answer.',
    structure:
      'For each key idea, B states the common misunderstanding or the tempting wrong answer, A explains why it is wrong and gives the correct version, and they contrast the two in a memorable line. Contrast is what makes the right answer stick.',
  },
  coach: {
    label: 'Exam coach',
    blurb: 'What examiners ask, how to answer, and the traps.',
    structure:
      'A is an exam coach and B is a student preparing for the exam. Cover what examiners usually ask about this material, how to structure a strong answer, the key terms that earn marks, and the common traps. Name likely exam questions and model the opening of a good answer.',
  },
  rapid: {
    label: 'Rapid-fire',
    blurb: 'Fast, punchy last-minute revision.',
    structure:
      'Quick, high-energy revision: short turns, one fact or definition per turn, immediately repeated back by the other host. Group items into numbered sets of three, with a quick recall pause after each set. No long explanations.',
  },
};

export const GOAL_INFO: Record<AudioGoal, { label: string; blurb: string; candidates: AudioFormat[]; guidance: string }> = {
  learn: {
    label: 'Learn it',
    blurb: 'First time through the material.',
    candidates: ['walkthrough', 'story', 'myth'],
    guidance: 'The listener is meeting this material for the first time. Build understanding step by step and favour analogies and examples over detail.',
  },
  lock: {
    label: 'Lock it in',
    blurb: 'You know it; make it stick.',
    candidates: ['quiz', 'myth', 'coach', 'walkthrough'],
    guidance: 'The listener has seen this before. Favour retrieval practice, contrasts and "why" questions over first explanations.',
  },
  cram: {
    label: 'Last-minute',
    blurb: 'Exam is close. Cover it fast.',
    candidates: ['rapid', 'coach'],
    guidance: 'The exam is close. Prioritise the most examinable points, key definitions and traps. Be brisk and cut anything that is not examinable.',
  },
};

/** The format to use: the goal's candidate that was used least recently on this source (never-used first). */
export function chooseFormat(goal: AudioGoal, recent: AudioFormat[]): AudioFormat {
  const candidates = GOAL_INFO[goal].candidates;
  let best = candidates[0];
  let bestAge = -1;
  for (const format of candidates) {
    const at = recent.indexOf(format); // 0 = used most recently
    const age = at === -1 ? Number.POSITIVE_INFINITY : at;
    if (age > bestAge) {
      best = format;
      bestAge = age;
    }
  }
  return best;
}

export function isFormat(x: unknown): x is AudioFormat {
  return typeof x === 'string' && x in FORMAT_INFO;
}
export function isGoal(x: unknown): x is AudioGoal {
  return typeof x === 'string' && x in GOAL_INFO;
}
export function isTier(x: unknown): x is LengthTier {
  return x === 5 || x === 10 || x === 15;
}

// Spoken English runs at about 150 words a minute, or roughly 900 characters.
export const WORDS_PER_MINUTE = 150;
export const CHARS_PER_MINUTE = 900;
/** No episode is ever shorter or longer than this, whatever was asked for. */
export const HARD_MIN_MINUTES = 4;
export const HARD_MAX_MINUTES = 20;

/** The character range an episode of this tier must land in: the tier's minutes, give or take 20 percent. */
export function lengthRange(tier: LengthTier): { minChars: number; maxChars: number; targetWords: number } {
  const minutes = Math.min(HARD_MAX_MINUTES, Math.max(HARD_MIN_MINUTES, tier));
  return {
    minChars: Math.round(minutes * 0.8 * CHARS_PER_MINUTE),
    maxChars: Math.round(minutes * 1.2 * CHARS_PER_MINUTE),
    targetWords: minutes * WORDS_PER_MINUTE,
  };
}

/** A short source cannot honestly fill a long episode. Returns the longest tier the source supports. */
export function tierForSource(sourceChars: number, wanted: LengthTier): LengthTier {
  // An explanation can run about three times the length of what it explains before it starts to pad.
  const supportedMinutes = (sourceChars * 3) / CHARS_PER_MINUTE;
  if (supportedMinutes >= wanted) return wanted;
  return wanted === 15 && supportedMinutes >= 10 ? 10 : wanted >= 10 && supportedMinutes >= 5 ? 5 : 5;
}
