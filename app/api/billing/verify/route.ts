import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { fulfil, paymentsOn, verifyTransaction } from '@/lib/billing';
import { logActivity } from '@/lib/audit-log';

// Called when the student comes back from Paystack. Confirms the payment with Paystack and applies it.
// The webhook does the same job; whichever arrives first wins and the other finds it already done.
export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    if (!paymentsOn()) return NextResponse.json({ error: 'Payments are not switched on yet.' }, { status: 503 });

    const reference = new URL(req.url).searchParams.get('reference');
    if (!reference) return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 });

    const paid = await verifyTransaction(reference);
    // Only the account that paid can claim the payment.
    if (!paid || paid.userId !== user.id) {
      return NextResponse.json({ error: 'We could not confirm that payment yet. If you were charged, it will appear shortly.' }, { status: 404 });
    }
    const result = await fulfil(paid);
    if (!result.ok) return NextResponse.json({ error: 'That payment did not match anything we sell. Contact support with your reference.' }, { status: 400 });

    if (!result.duplicate) logActivity(user.id, 'payment_applied', `Paid for ${result.product.label}`, req).catch(console.error);
    return NextResponse.json({ ok: true, label: result.product.label });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Could not confirm that payment. Please refresh in a moment.' }, { status: 500 });
  }
}
