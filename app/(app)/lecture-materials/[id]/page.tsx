import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import DocumentReader from '@/components/DocumentReader';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';

export default async function LectureMaterialReader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const document = user
    ? await prisma.document.findFirst({
        where: { id, workspace: { userId: user.id } }
      })
    : null;

  if (!document) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-4">Document Not Found</h1>
        <Link href="/vault" className="text-orange-500 hover:underline">
          Return to Vault
        </Link>
      </div>
    );
  }

  const isPdf = document.name?.toLowerCase().endsWith('.pdf');

  return (
    <div className="h-screen w-screen bg-zinc-950 text-slate-100 flex flex-col overflow-hidden">
      <nav className="shrink-0 h-16 backdrop-blur-xl bg-zinc-900/50 border-b border-zinc-800/50 flex items-center justify-between px-6 z-40">
        <Link href="/vault" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-1/3">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium text-sm hidden sm:inline">Back to Vault</span>
        </Link>

        <div className="flex-1 text-center font-semibold text-white truncate px-4">
          {document.name}
        </div>

        <div className="w-1/3 flex justify-end"></div>
      </nav>

      <div className="flex-1 w-full relative overflow-hidden flex flex-col">
        {isPdf ? (
          <>
            <iframe
              src={`${document.url}#toolbar=0&navpanes=0`}
              className="w-full h-full border-none bg-zinc-900 flex-1"
              title={document.name}
            />
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
               <a
                 href={document.url || '#'}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="flex items-center gap-2 bg-zinc-800/80 backdrop-blur-md border border-zinc-700/50 rounded-full px-5 py-2 shadow-2xl text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
               >
                 <Download className="w-4 h-4" />
                 <span className="text-sm font-medium">Download Original</span>
               </a>
            </div>
          </>
        ) : (
          <DocumentReader document={document} />
        )}
      </div>
    </div>
  );
}
