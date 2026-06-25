import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace id" }, { status: 400 });
    }

    // 1. Get all documents for this workspace
    const docs = await prisma.document.findMany({
      where: { workspaceId }
    });

    // 2. Extract storage paths
    const pathsToDelete = docs.map(doc => {
      const urlParts = doc.url.split('workspace-files/');
      return urlParts.length > 1 ? urlParts[1] : null;
    }).filter(Boolean) as string[];

    // 3. Delete files from Supabase Storage
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('workspace-files')
        .remove(pathsToDelete);
        
      if (storageError) {
        console.error("Supabase Storage Deletion Error:", storageError);
        // Continue anyway to ensure the DB is cleaned up even if storage fails
      }
    }

    // 4. Delete the workspace (Cascade will handle Documents, Messages, Chunks)
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
