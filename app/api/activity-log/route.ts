import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { logActivity } from '@/lib/audit-log';

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { action, details } = await req.json().catch(() => ({}));
  if (!action || !details) {
    return NextResponse.json({ error: 'Missing action or details' }, { status: 400 });
  }

  await logActivity(user.id, action, details, req);
  return NextResponse.json({ success: true });
}
