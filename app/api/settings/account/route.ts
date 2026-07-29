import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("Supabase Auth deletion error:", error);
      return NextResponse.json({ error: "Account data was deleted, but there was an issue removing your login. Please contact support." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account Deletion Error:", error);
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}
