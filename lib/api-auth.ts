import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';

// Confirms someone is logged in. Use this at the top of every route.
export async function requireUser() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    return { user, response: null };
  } catch (error) {
    console.error("requireUser error:", error);
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
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

// Only allow server-side fetches of files that live in our own Supabase storage (blocks SSRF).
export function isTrustedStorageUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const u = new URL(raw);
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    return u.protocol === 'https:' && u.host === base.host && u.pathname.startsWith('/storage/v1/object/');
  } catch {
    return false;
  }
}

// For user-supplied website imports: http(s) only, no loopback/private/link-local hosts.
// Hostname-level check only; it does not resolve DNS.
export function isPublicWebUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (h.startsWith('[') || h.includes(':')) return false; // IPv6 literals
    const m = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]);
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function badFileUrlResponse() {
  return NextResponse.json({ error: "Invalid file URL." }, { status: 400 });
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
