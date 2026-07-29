import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

// Confirms someone is logged in. Use this at the top of every route.
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

// Confirms a specific workspace actually belongs to this logged-in user.
export async function requireWorkspaceOwnership(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || workspace.userId !== userId) {
    return { workspace: null, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { workspace, response: null };
}

// Confirms a specific document actually belongs to this logged-in user (via its workspace).
export async function requireDocumentOwnership(documentId: string, userId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { workspace: true }
  });
  if (!doc || doc.workspace.userId !== userId) {
    return { doc: null, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { doc, response: null };
}

// Every user gets their own personal vault, found or created automatically.
export async function getOrCreateUserVault(userId: string) {
  let vault = await prisma.workspace.findFirst({
    where: { userId, title: 'My Global Vault' }
  });
  if (!vault) {
    vault = await prisma.workspace.create({
      data: { userId, title: 'My Global Vault' }
    });
  }
  return vault;
}

export async function requireStudyGuideOwnership(guideId: string, userId: string) {
  const guide = await prisma.studyGuide.findUnique({ where: { id: guideId } });
  if (!guide || guide.userId !== userId) {
    return { guide: null, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { guide, response: null };
}
