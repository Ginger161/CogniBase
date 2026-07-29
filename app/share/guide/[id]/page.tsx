import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function SharedGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const guide = await prisma.studyGuide.findFirst({
    where: { id, isPublic: true }
  });

  if (!guide) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold text-white mb-3">This guide isn't available</h1>
        <p className="text-zinc-400 mb-6">It may have been unshared, or the link is incorrect.</p>
        <Link href="/" className="text-orange-500 hover:underline">Go to CogniBase</Link>
      </div>
    );
  }

  let data: any = null;
  try {
    data = typeof guide.strategyData === 'string' ? JSON.parse(guide.strategyData as any) : guide.strategyData;
  } catch (e) {
    data = null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100">
      <div className="bg-[#EA580C] text-white text-sm font-medium px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
        <span>You're viewing a study guide made with CogniBase.</span>
        <Link href="/signup" className="underline font-bold">Sign up free to make your own & unlock the full interactive version →</Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">{data?.guideTitle || guide.title || 'Study Guide'}</h1>
        <p className="text-zinc-500 mb-10">Shared from CogniBase</p>

        {!data?.phases ? (
          <p className="text-zinc-400">This guide couldn't be displayed.</p>
        ) : (
          <div className="flex flex-col gap-10">
            {data.phases.map((phase: any, i: number) => (
              <div key={phase.phaseId || i} className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900/40">
                <h2 className="text-xl font-bold text-white mb-4">{phase.title}</h2>

                {Array.isArray(phase.microBites) && phase.microBites.length > 0 && (
                  <div className="flex flex-col gap-3 mb-6">
                    {phase.microBites.map((bite: string, bIdx: number) => (
                      <p key={bIdx} className="text-zinc-300 leading-relaxed">{bite}</p>
                    ))}
                  </div>
                )}

                {Array.isArray(phase.flashcards) && phase.flashcards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Knowledge check</p>
                    {phase.flashcards.map((card: any, cIdx: number) => (
                      <div key={cIdx} className="bg-black border border-zinc-800 rounded-xl p-4">
                        <p className="text-white font-medium mb-2">{card.question}</p>
                        <div className="relative">
                          <p className="text-zinc-600 blur-sm select-none">{card.answer}</p>
                          <Link href="/signup" className="absolute inset-0 flex items-center justify-center text-xs font-bold text-orange-500 hover:text-orange-400 bg-zinc-900/60 rounded">
                            Sign up free to reveal
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/signup" className="inline-block bg-[#EA580C] hover:bg-[#c2410c] text-white font-bold px-8 py-4 rounded-xl transition-colors">
            Get the full interactive experience — sign up free
          </Link>
        </div>
      </div>
    </div>
  );
}
