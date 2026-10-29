import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin';
import { DEFAULT_SWITCHES, getSwitches, saveSwitches, type Switches } from '@/lib/settings';
import { logActivity } from '@/lib/audit-log';

export async function GET() {
  try {
    const { user, response } = await requireStaff('settings.manage');
    if (!user) return response;
    return NextResponse.json(await getSwitches());
  } catch (error) {
    console.error('Switches GET error:', error);
    return NextResponse.json({ error: 'Could not load the switches.' }, { status: 500 });
  }
}

// Body: { off: { chat, generate, uploads, audio }, message }. Takes effect for everyone within seconds.
export async function PUT(req: Request) {
  try {
    const { user, staff, response } = await requireStaff('settings.manage');
    if (!user || !staff) return response;

    const b = await req.json().catch(() => ({}));
    const next: Switches = {
      off: {
        chat: b.off?.chat === true,
        generate: b.off?.generate === true,
        uploads: b.off?.uploads === true,
        audio: b.off?.audio === true,
      },
      message: typeof b.message === 'string' && b.message.trim() ? b.message.trim().slice(0, 200) : DEFAULT_SWITCHES.message,
    };
    await saveSwitches(next, user.id);

    const off = Object.entries(next.off).filter(([, v]) => v).map(([k]) => k);
    logActivity(user.id, 'admin_switches', `${staff.email} set switches off: ${off.join(', ') || 'none'}`, req).catch(console.error);
    return NextResponse.json(next);
  } catch (error) {
    console.error('Switches PUT error:', error);
    return NextResponse.json({ error: 'Could not save the switches.' }, { status: 500 });
  }
}
