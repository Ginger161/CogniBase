import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireUser, requireWorkspaceOwnership, getOrCreateUserVault } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
    }

    const { workspace, response: ownerResp } = await requireWorkspaceOwnership(workspaceId, user.id);
    if (!workspace) return ownerResp;

    // 0. Ensure user Vault exists
    const vault = await getOrCreateUserVault(user.id);

    // 1. Move all documents for this workspace into the User's Vault so they survive the Cascade
    await prisma.document.updateMany({
      where: { workspaceId },
      data: { workspaceId: vault.id }
    });

    // 2. Delete the workspace (Cascade will handle Messages, but Documents are safe now)
    try {
      await prisma.workspace.delete({
        where: { id: workspaceId }
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2025') {
        // Record already deleted, safely ignore
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
