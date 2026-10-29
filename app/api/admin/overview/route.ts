import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin';
import { overviewStats } from '@/lib/admin-stats';

export async function GET() {
  try {
    const { user, response } = await requireStaff('overview.view');
    if (!user) return response;
    return NextResponse.json(await overviewStats());
  } catch (error) {
    console.error('Overview error:', error);
    return NextResponse.json({ error: 'Could not load the overview.' }, { status: 500 });
  }
}
