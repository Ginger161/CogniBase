import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
try {
const { name, url, workspaceId } = await req.json();

let targetWorkspaceId = workspaceId;

// If no workspaceId is passed (like from the main Vault page), use a Global Workspace
if (!targetWorkspaceId) {
  const globalWorkspace = await prisma.workspace.upsert({
    where: { id: 'global-vault-001' },
    update: {},
    create: {
      id: 'global-vault-001',
      title: 'My Global Vault',
    },
  });
  targetWorkspaceId = globalWorkspace.id;
}

const newDoc = await prisma.document.create({
  data: { name, url, workspaceId: targetWorkspaceId }
});

return NextResponse.json(newDoc);
} catch (error) {
console.error("API Crash Error:", error);
const errorMessage = error instanceof Error ? error.message : "Unknown server error";
return NextResponse.json({ error: errorMessage }, { status: 500 });
}
}

// Fetch all documents for a workspace
export async function GET(req: Request) {
try {
const { searchParams } = new URL(req.url);
const workspaceId = searchParams.get('workspaceId') || 'global-vault-001';

const docs = await prisma.document.findMany({
where: { workspaceId },
orderBy: { createdAt: 'desc' }
});

console.log("🔍 Fetching docs for ID:", workspaceId, "Found:", docs.length);
return NextResponse.json(docs);
} catch (error) {
console.error("API Crash Error:", error);
const errorMessage = error instanceof Error ? error.message : "Unknown server error";
return NextResponse.json({ error: errorMessage }, { status: 500 });
}
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    await prisma.document.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Crash Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
