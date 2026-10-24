import { prisma } from '@/lib/prisma';

export type ScopedDoc = { id: string; name: string; workspaceId: string };

const MAX_SCOPED_DOCS = 20;

/**
 * Resolve which documents a request is allowed to touch.
 * Always filtered by ownership, whatever ids the client sends.
 *  - documentIds given   -> exactly those (that the user owns)
 *  - else workspaceId    -> that workspace's documents
 *  - else                -> [] (callers decide whether "everything the user owns" is acceptable)
 */
export async function resolveScopedDocs(
  userId: string,
  scope: { workspaceId?: string | null; documentIds?: unknown }
): Promise<ScopedDoc[]> {
  const ids = Array.isArray(scope.documentIds)
    ? scope.documentIds.filter((x): x is string => typeof x === 'string').slice(0, MAX_SCOPED_DOCS)
    : [];

  if (ids.length > 0) {
    return prisma.document.findMany({
      where: { id: { in: ids }, workspace: { userId } },
      select: { id: true, name: true, workspaceId: true },
    });
  }
  if (scope.workspaceId) {
    return prisma.document.findMany({
      where: { workspaceId: scope.workspaceId, workspace: { userId } },
      select: { id: true, name: true, workspaceId: true },
      take: MAX_SCOPED_DOCS,
    });
  }
  return [];
}

/** Full text of the scoped documents, in reading order (chunk ids sort by position). */
export async function getScopedText(
  userId: string,
  scope: { workspaceId?: string | null; documentIds?: unknown }
): Promise<string> {
  const docs = await resolveScopedDocs(userId, scope);
  if (docs.length === 0) return '';
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: { in: docs.map((d) => d.id) } },
    orderBy: [{ documentId: 'asc' }, { id: 'asc' }],
    select: { content: true },
  });
  return chunks.map((c) => c.content).join('\n');
}
