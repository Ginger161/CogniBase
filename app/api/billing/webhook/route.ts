import { NextResponse } from 'next/server';
import { fulfil, signatureIsValid, verifyTransaction } from '@/lib/billing';

// Paystack calls this when a payment succeeds, even if the student closed the tab. Set it as the webhook URL in
// the Paystack dashboard. Public by design, so the only thing that lets a request in is the signature.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!signatureIsValid(raw, req.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } };
    if (event.event === 'charge.success' && typeof event.data?.reference === 'string') {
      // Confirm with Paystack rather than trusting the body, then apply (a repeat is harmless).
      const paid = await verifyTransaction(event.data.reference);
      if (paid) await fulfil(paid);
    }
  } catch (error) {
    console.error('Webhook error:', error);
    // A 500 makes Paystack retry later, which is what we want if applying the payment failed.
    return NextResponse.json({ error: 'Could not process' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
