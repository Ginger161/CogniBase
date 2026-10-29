import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { requireUser } from '@/lib/api-auth';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { addVoices, isEpisodeContent } from '@/lib/audio/episode';
import { checkVoiceAllowance } from '@/lib/audio/limits';
import { getTtsProvider } from '@/lib/audio/tts';
import { recordUsage } from '@/lib/usage';

export const maxDuration = 120;

// Stage two: voices a saved script. Runs only when the student's plan and the app-wide voice budget allow it.
// A refusal never costs the student their transcript.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    const limited = rateLimit(user.id, LIMITS.audio);
    if (limited) return limited;

    const { assetId } = await req.json().catch(() => ({}));
    if (typeof assetId !== 'string') return NextResponse.json({ error: 'Missing episode.' }, { status: 400 });

    const asset = await prisma.studioAsset.findFirst({
      where: { id: assetId, type: 'AUDIO', workspace: { userId: user.id } },
      select: { id: true, content: true },
    });
    if (!asset || !isEpisodeContent(asset.content)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (asset.content.audioPath) return NextResponse.json({ success: true });

    if (!getTtsProvider()) {
      return NextResponse.json({ error: 'Voices are not switched on yet. Your transcript is ready to read.' }, { status: 503 });
    }
    const allowed = await checkVoiceAllowance(user.id, asset.content);
    if (!allowed.ok) return NextResponse.json({ error: allowed.message }, { status: allowed.status });

    const supabase = await createClient();
    const voiced = await addVoices(supabase, user.id, asset.id, asset.content.turns);
    const rest = { ...asset.content };
    delete rest.audioNote;
    await prisma.studioAsset.update({ where: { id: asset.id }, data: { content: { ...rest, ...voiced } as unknown as Prisma.InputJsonObject } });

    if (!voiced.audioPath) return NextResponse.json({ error: voiced.audioNote ?? 'Voices could not be added.' }, { status: 502 });
    // Counted only once the audio exists, so a failed voicing costs the student nothing.
    if (allowed.metered) await recordUsage(user.id, 'audio_minute', Math.ceil(asset.content.minutes));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Audio synthesize error:', error);
    return NextResponse.json({ error: 'Could not add voices. Please try again.' }, { status: 500 });
  }
}
