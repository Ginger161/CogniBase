export type AiFailure = { status: number; message: string; kind: 'quota' | 'busy' | 'timeout' | 'blocked' | 'other' };

/** Turn a provider error into a status code and a message that is safe to show. */
export function classifyAiError(err: unknown): AiFailure {
  const raw = (() => {
    if (err instanceof Error) return `${err.name} ${err.message} ${(err as { cause?: { message?: string } }).cause?.message ?? ''}`;
    return String(err);
  })();
  const text = raw.toLowerCase();

  if (text.includes('exceeded your current quota') || text.includes('resource_exhausted') || text.includes('free_tier')) {
    return { status: 429, kind: 'quota', message: "The AI's daily usage limit has been reached. Try again later." };
  }
  if (text.includes('429') || text.includes('rate limit')) {
    return { status: 429, kind: 'busy', message: "You're asking the AI too fast. Wait a moment and try again." };
  }
  if (text.includes('abort') || text.includes('timeout') || text.includes('timed out') || text.includes('deadline') || text.includes('504')) {
    return { status: 504, kind: 'timeout', message: 'That took too long. Try again, or use a smaller source.' };
  }
  if (text.includes('503') || text.includes('overloaded') || text.includes('high demand') || text.includes('unavailable')) {
    return { status: 503, kind: 'busy', message: 'The AI servers are busy. Please try again in a moment.' };
  }
  if (text.includes('safety') || text.includes('blocked') || text.includes('prohibited')) {
    return { status: 422, kind: 'blocked', message: "The AI couldn't work with that content. Try a different source." };
  }
  // A bad key, a missing permission or a retired model is our problem, not the user's: say so honestly.
  if (text.includes('api key') || text.includes('api_key') || text.includes('permission_denied') || text.includes('403') || text.includes('404')) {
    console.error('AI configuration problem:', raw);
    return { status: 503, kind: 'other', message: 'The AI is unavailable right now. Please try again later.' };
  }
  return { status: 502, kind: 'other', message: 'Could not reach the AI. Please try again.' };
}
