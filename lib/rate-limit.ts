import { NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };

// Per server instance. On serverless this is a best-effort brake against runaway clients and loops,
// not a hard quota: each warm instance counts separately. For hard limits back this with a shared store.
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export type Limit = { name: string; max: number; windowMs: number };

export const LIMITS = {
  chat: { name: 'chat', max: 20, windowMs: 60_000 },
  generate: { name: 'generate', max: 8, windowMs: 60_000 },
  index: { name: 'index', max: 10, windowMs: 60_000 },
  ingest: { name: 'ingest', max: 20, windowMs: 60_000 },
  audio: { name: 'audio', max: 3, windowMs: 60_000 },
} satisfies Record<string, Limit>;

/** Returns a 429 response when the user is over the limit, otherwise null. */
export function rateLimit(userId: string, limit: Limit): NextResponse | null {
  const now = Date.now();
  const key = `${limit.name}:${userId}`;

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return null;
  }
  bucket.count++;
  if (bucket.count <= limit.max) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return NextResponse.json(
    { error: `You're going a little fast. Try again in ${retryAfter}s.` },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
