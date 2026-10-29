import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireUser } from '@/lib/api-auth';
import { initializeTransaction, paymentsOn, productFor } from '@/lib/billing';
import { logActivity } from '@/lib/audit-log';

// Starts a Paystack payment for a credit pack or a plan and returns the page to pay on.
// Body: { product: "credits:c300" | "plan:PRO" }.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    if (!paymentsOn()) {
      return NextResponse.json({ error: 'Payments are not switched on yet. Please try again soon.' }, { status: 503 });
    }
    if (!user.email) return NextResponse.json({ error: 'Your account needs an email address to pay.' }, { status: 400 });

    const { product: id } = await req.json().catch(() => ({}));
    const product = productFor(id);
    if (!product) return NextResponse.json({ error: 'That is not something you can buy.' }, { status: 400 });

    const reference = `cb_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`;
    const url = await initializeTransaction({
      email: user.email,
      amountNgn: product.priceNgn,
      reference,
      callbackUrl: `${new URL(req.url).origin}/billing`,
      // The webhook and the return page read who paid and for what from here, and still re-check the amount.
      metadata: { userId: user.id, product: product.id },
    });
    if (!url) return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 502 });

    logActivity(user.id, 'checkout_started', `Started a payment for ${product.label}`, req).catch(console.error);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
