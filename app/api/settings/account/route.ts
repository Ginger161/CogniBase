import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

export async function DELETE() {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Remove the user's uploaded files from storage before their records (which hold the paths) are deleted.
    const docs = await prisma.document.findMany({
      where: { workspace: { userId: user.id }, sourceType: 'file' },
      select: { url: true },
    });
    const paths = docs
      .map((d) => d.url.split('workspace-files/')[1])
      .filter((p): p is string => !!p)
      .map((p) => decodeURIComponent(p));
    for (let i = 0; i < paths.length; i += 100) {
      const { error: storageError } = await supabaseAdmin.storage.from('workspace-files').remove(paths.slice(i, i + 100));
      if (storageError) {
        console.error('Storage cleanup failed during account deletion:', storageError);
        return NextResponse.json({ error: 'Could not remove your uploaded files, so nothing was deleted. Please try again.' }, { status: 500 });
      }
    }

    await prisma.user.delete({ where: { id: user.id } });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("Supabase Auth deletion error:", error);
      return NextResponse.json({ error: "Account data was deleted, but there was an issue removing your login. Please contact support." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account Deletion Error:", error);
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}
