export type AiFailure = { status: number; message: string; kind: 'quota' | 'busy' | 'other' };

/** Turn a provider error into a status code and a message that is safe to show. */
export function classifyAiError(err: unknown): AiFailure {
  const raw = (() => {
    if (err instanceof Error) return `${err.message} ${(err as { cause?: { message?: string } }).cause?.message ?? ''}`;
    return String(err);
  })();
  const text = raw.toLowerCase();

  if (text.includes('exceeded your current quota') || text.includes('resource_exhausted') || text.includes('free_tier')) {
    return { status: 429, kind: 'quota', message: "The AI's daily usage limit has been reached. Try again later." };
  }
  if (text.includes('429') || text.includes('rate limit')) {
    return { status: 429, kind: 'busy', message: "You're asking the AI too fast. Wait a moment and try again." };
  }
  if (text.includes('503') || text.includes('overloaded') || text.includes('high demand') || text.includes('unavailable')) {
    return { status: 503, kind: 'busy', message: 'The AI servers are busy. Please try again in a moment.' };
  }
  return { status: 502, kind: 'other', message: 'Could not reach the AI. Please try again.' };
}
