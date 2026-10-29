import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import DocumentReader from '@/components/DocumentReader';
import Link from 'next/link';

// Private buckets need a signed link; public ones keep working with the stored URL.
async function viewableUrl(supabase: Awaited<ReturnType<typeof createClient>>, url: string): Promise<string> {
  const marker = 'workspace-files/';
  const at = url.indexOf(marker);
  if (at < 0) return url;
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
  const { data, error } = await supabase.storage.from('workspace-files').createSignedUrl(path, 3600);
  return error || !data?.signedUrl ? url : data.signedUrl;
}

export default async function LectureMaterialReader({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ console?: string; audio?: string }>;
}) {
  const { id } = await params;
  const { console: consoleParam, audio: audioParam } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const document = user
    ? await prisma.document.findFirst({
        where: { id, workspace: { userId: user.id } },
        select: { id: true, name: true, url: true, sourceType: true, textContent: true, workspaceId: true },
      })
    : null;

  if (!document) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 px-5 text-center">
        <h1 className="text-2xl font-bold">Source not found</h1>
        <p className="text-[var(--text-secondary)]">It may have been deleted.</p>
        <Link href="/vault" className="h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center">
          Back to Library
        </Link>
      </div>
    );
  }

  // Where the reader left off. Optional: the reader opens at the top if this cannot be loaded.
  const saved = user
    ? await prisma.readingProgress.findUnique({ where: { userId_documentId: { userId: user.id, documentId: id } }, select: { progress: true } }).catch(() => null)
    : null;

  const isPdf = document.sourceType === 'file' && document.name.toLowerCase().endsWith('.pdf');
  const fileUrl = isPdf ? await viewableUrl(supabase, document.url) : null;

  return <DocumentReader document={document} pdfUrl={fileUrl} openConsole={consoleParam === '1'} openAudio={audioParam === '1'} initialProgress={saved?.progress ?? 0} />;
}
