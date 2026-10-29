import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { PLANS, type PlanTier } from '@/lib/plans';
import { grantCredits, setPlan } from '@/lib/usage';

// What can be bought. Prices live here, on the server, and a payment is only honoured if the amount paid matches.

export const CREDIT_PACKS = [
  { id: 'c100', credits: 100, priceNgn: 1500, blurb: 'About 10 minutes of audio, or a month of light chat' },
  { id: 'c300', credits: 300, priceNgn: 4000, blurb: 'About 30 minutes of audio' },
  { id: 'c800', credits: 800, priceNgn: 9500, blurb: 'Best value for exam season' },
] as const;

export const PLAN_DAYS = 30;

export type Product =
  | { kind: 'credits'; id: string; credits: number; priceNgn: number; label: string }
  | { kind: 'plan'; id: string; tier: PlanTier; days: number; priceNgn: number; label: string };

/** Looks up a product by the id the client sent ("credits:c300" or "plan:PRO"). Unknown ids are null. */
export function productFor(id: unknown): Product | null {
  if (typeof id !== 'string') return null;
  const [kind, key] = id.split(':');
  if (kind === 'credits') {
    const pack = CREDIT_PACKS.find((p) => p.id === key);
    return pack ? { kind: 'credits', id, credits: pack.credits, priceNgn: pack.priceNgn, label: `${pack.credits} credits` } : null;
  }
  if (kind === 'plan' && (key === 'PRO' || key === 'X')) {
    return { kind: 'plan', id, tier: key, days: PLAN_DAYS, priceNgn: PLANS[key].priceNgn, label: `${PLANS[key].label} plan, ${PLAN_DAYS} days` };
  }
  return null;
}

// ── Paystack ─────────────────────────────────────────────────────────────

const secret = () => process.env.PAYSTACK_SECRET_KEY || '';
export const paymentsOn = () => secret().length > 0;

export async function initializeTransaction(args: { email: string; amountNgn: number; reference: string; callbackUrl: string; metadata: Record<string, string> }): Promise<string | null> {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: args.email,
      amount: args.amountNgn * 100, // Paystack counts in kobo
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null);
  return typeof body?.data?.authorization_url === 'string' ? body.data.authorization_url : null;
}

export type PaidTransaction = { reference: string; amountKobo: number; userId: string; product: string };

/** Asks Paystack whether a payment really succeeded. Returns null if it did not, or cannot be confirmed. */
export async function verifyTransaction(reference: string): Promise<PaidTransaction | null> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret()}` },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const d = (await res.json().catch(() => null))?.data;
  if (d?.status !== 'success' || typeof d.amount !== 'number') return null;
  const userId = d.metadata?.userId;
  const product = d.metadata?.product;
  return typeof userId === 'string' && typeof product === 'string' ? { reference: d.reference, amountKobo: d.amount, userId, product } : null;
}

/** Paystack signs every webhook with HMAC SHA-512 of the raw body, using the secret key. */
export function signatureIsValid(rawBody: string, header: string | null): boolean {
  if (!header || !secret()) return false;
  const expected = createHmac('sha512', secret()).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Gives the student what they paid for. Safe to call more than once for the same payment (the webhook and
 * the return page both do): the reference is recorded first, and a repeat finds it and does nothing.
 */
export async function fulfil(paid: PaidTransaction): Promise<{ ok: true; product: Product; duplicate: boolean } | { ok: false }> {
  const product = productFor(paid.product);
  // The amount paid must match our price, so a tampered request cannot buy a pack for less.
  if (!product || paid.amountKobo !== product.priceNgn * 100) return { ok: false };
  if (!(await prisma.user.findUnique({ where: { id: paid.userId }, select: { id: true } }))) return { ok: false };

  // Kept for finance reporting. A repeat of the same payment hits the unique reference and is ignored.
  await prisma.payment.create({ data: { userId: paid.userId, reference: paid.reference, product: product.id, amountNgn: product.priceNgn } }).catch(() => {});

  const ref = `pay:${paid.reference}`;
  if (product.kind === 'credits') {
    const result = await grantCredits({ userId: paid.userId, amount: product.credits, reason: 'PURCHASE', ref, note: product.label });
    return { ok: true, product, duplicate: result === 'duplicate' };
  }
  // A plan payment leaves a zero-credit marker so the same payment is never applied twice.
  const marker = await grantCredits({ userId: paid.userId, amount: 0, reason: 'PLAN', ref, note: product.label }).catch(() => 'duplicate' as const);
  if (marker === 'duplicate') return { ok: true, product, duplicate: true };
  await setPlan(paid.userId, product.tier, product.days);
  return { ok: true, product, duplicate: false };
}
