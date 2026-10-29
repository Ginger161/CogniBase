import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/admin';
import { fundsSummary } from '@/lib/admin-stats';
import { logActivity } from '@/lib/audit-log';

const CATEGORIES = ['Hosting', 'Database', 'AI', 'Voice', 'Domain', 'Payments', 'Marketing', 'Other'];

export async function GET() {
  try {
    const { user, response } = await requireStaff('funds.view');
    if (!user) return response;
    const summary = await fundsSummary();
    return NextResponse.json({ ...summary, categories: CATEGORIES });
  } catch (error) {
    console.error('Funds GET error:', error);
    return NextResponse.json({ error: 'Could not load costs.' }, { status: 500 });
  }
}

// Adds an expense. Body: { label, category, amountNgn, date: "YYYY-MM-DD", recurring?: "monthly" | "yearly", note? }.
export async function POST(req: Request) {
  try {
    const { user, staff, response } = await requireStaff('funds.edit');
    if (!user || !staff) return response;

    const b = await req.json().catch(() => ({}));
    const label = typeof b.label === 'string' ? b.label.trim().slice(0, 80) : '';
    const amountNgn = Number(b.amountNgn);
    if (!label) return NextResponse.json({ error: 'Give the expense a name.' }, { status: 400 });
    if (!Number.isInteger(amountNgn) || amountNgn <= 0 || amountNgn > 1_000_000_000) return NextResponse.json({ error: 'Enter the amount in whole naira.' }, { status: 400 });
    if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return NextResponse.json({ error: 'Choose the date.' }, { status: 400 });
    const category = CATEGORIES.includes(b.category) ? b.category : 'Other';
    const recurring = b.recurring === 'monthly' || b.recurring === 'yearly' ? b.recurring : null;

    const expense = await prisma.expense.create({
      data: { label, category, amountNgn, incurredOn: new Date(`${b.date}T12:00:00.000Z`), recurring, note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) || null : null, createdById: user.id },
    });
    logActivity(user.id, 'admin_expense', `${staff.email} added expense ${label} (${amountNgn})`, req).catch(console.error);
    return NextResponse.json({ expense });
  } catch (error) {
    console.error('Funds POST error:', error);
    return NextResponse.json({ error: 'Could not save that expense.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, staff, response } = await requireStaff('funds.edit');
    if (!user || !staff) return response;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing expense.' }, { status: 400 });
    const gone = await prisma.expense.delete({ where: { id } }).catch(() => null);
    if (!gone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    logActivity(user.id, 'admin_expense', `${staff.email} removed expense ${gone.label}`, req).catch(console.error);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Funds DELETE error:', error);
    return NextResponse.json({ error: 'Could not remove that expense.' }, { status: 500 });
  }
}
