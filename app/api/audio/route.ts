import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { requireDocumentOwnership, requireUser } from '@/lib/api-auth';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { recordMetric } from '@/lib/metrics';
import { classifyAiError } from '@/lib/ai-errors';
import { writeScript } from '@/lib/audio/script';
import { isEpisodeContent, signedAudioUrl, type EpisodeContent } from '@/lib/audio/episode';
import { getTtsProvider } from '@/lib/audio/tts';
import { checkScriptAllowance, planOf } from '@/lib/audio/limits';
import { recordUsage } from '@/lib/usage';
import { splitIntoParts } from '@/lib/audio/parts';
import { chooseFormat, isFormat, isGoal, isTier, tierForSource, type AudioFormat } from '@/lib/audio/formats';

// Writing a 15-minute script can take a couple of minutes. (Needs a hosting plan that allows long functions.)
export const maxDuration = 300;

// Saved episodes for one source, with a fresh link to each one's audio and what the student's plan allows.
export async function GET(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;

    const documentId = new URL(req.url).searchParams.get('documentId');
    if (!documentId) return NextResponse.json({ error: 'Missing source.' }, { status: 400 });
    const { doc, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!doc) return ownerResp;

    const assets = await prisma.studioAsset.findMany({
      where: { type: 'AUDIO', workspace: { userId: user.id }, content: { path: ['documentId'], equals: documentId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, createdAt: true },
    });

    const supabase = await createClient();
    const plan = await planOf(user.id);
    const episodes = await Promise.all(
      assets.map(async (a) => {
        const c = isEpisodeContent(a.content) ? a.content : null;
        return {
          id: a.id,
          title: a.title,
          createdAt: a.createdAt,
          format: c?.format ?? null,
          minutes: c?.minutes ?? null,
          part: c?.part ?? null,
          turns: c?.turns ?? [],
          chapters: c?.chapters ?? [],
          starts: c?.starts ?? null,
          durationSec: c?.durationSec ?? null,
          audioUrl: c?.audioPath ? await signedAudioUrl(supabase, c.audioPath) : null,
          audioNote: c?.audioNote ?? null,
        };
      })
    );
    return NextResponse.json({
      episodes,
      voicesOn: getTtsProvider() !== null,
      plan: { label: plan.label, maxEpisodeMinutes: plan.audio.maxEpisodeMinutes, series: plan.audio.series, download: plan.audio.download },
      parts: splitIntoParts((doc.textContent ?? '').trim()).length,
    });
  } catch (error) {
    console.error('Audio GET error:', error);
    return NextResponse.json({ error: 'Could not load your audio overviews.' }, { status: 500 });
  }
}

// Stage one of making an episode: writes the script. Voices are a separate step (/api/audio/synthesize),
// which keeps each request well inside the server time limit and lets a failed voicing be retried alone.
export async function POST(req: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response;
    const limited = rateLimit(user.id, LIMITS.audio);
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const { documentId, goal, length, format, part, regenerate } = body as Record<string, unknown>;
    if (typeof documentId !== 'string') return NextResponse.json({ error: 'Missing source.' }, { status: 400 });
    const { doc, response: ownerResp } = await requireDocumentOwnership(documentId, user.id);
    if (!doc) return ownerResp;

    const fullText = (doc.textContent ?? '').trim();
    if (!fullText) {
      return NextResponse.json({ error: 'This source has no readable text, so there is nothing to turn into audio.' }, { status: 400 });
    }

    const plan = await planOf(user.id);
    const parts = plan.audio.series ? splitIntoParts(fullText) : [splitIntoParts(fullText)[0]];
    const partNo = Number.isInteger(part) && (part as number) >= 1 && (part as number) <= parts.length ? (part as number) : 1;
    const text = parts[partNo - 1];

    const wantedGoal = isGoal(goal) ? goal : 'learn';
    const wantedTier = isTier(length) ? length : 10;
    const tier = tierForSource(text.length, wantedTier);

    const allowed = await checkScriptAllowance(user.id, tier);
    if (!allowed.ok) return NextResponse.json({ error: allowed.message }, { status: allowed.status });

    // Pick a format: the one asked for, or the goal's least-recently-used one so episodes do not repeat.
    const earlier = await prisma.studioAsset.findMany({
      where: { type: 'AUDIO', workspace: { userId: user.id }, content: { path: ['documentId'], equals: documentId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true },
    });
    const history = earlier.map((e) => (isEpisodeContent(e.content) ? e.content : null)).filter((c): c is EpisodeContent => !!c);
    const chosen: AudioFormat = isFormat(format) ? format : chooseFormat(wantedGoal, history.map((h) => h.format));

    // The same source, settings and part is never paid for twice unless the student asks to regenerate.
    const key = createHash('sha1').update(`${text}|${wantedGoal}|${chosen}|${tier}|${partNo}`).digest('hex').slice(0, 16);
    if (isFormat(format) && regenerate !== true) {
      const same = earlier.find((e) => isEpisodeContent(e.content) && e.content.key === key);
      if (same) return NextResponse.json({ id: same.id, cached: true });
    }

    let result;
    try {
      result = await writeScript({
        name: doc.name,
        text,
        format: chosen,
        goal: wantedGoal,
        tier,
        part: parts.length > 1 ? { index: partNo, total: parts.length } : undefined,
      });
    } catch (err) {
      console.error('Audio script failed:', err);
      const failure = classifyAiError(err);
      return NextResponse.json({ error: failure.message, code: failure.kind }, { status: failure.status });
    }
    if (!result) return NextResponse.json({ error: 'The AI could not write a usable script. Please try again.' }, { status: 502 });

    const { script, minutes } = result;
    const content: EpisodeContent = {
      documentId,
      turns: script.turns,
      chapters: script.chapters,
      format: chosen,
      goal: wantedGoal,
      tier,
      minutes,
      charCount: script.turns.reduce((n, t) => n + t.text.length, 0),
      key,
      ...(parts.length > 1 ? { part: { index: partNo, total: parts.length } } : {}),
    };
    const title = parts.length > 1 ? `${script.title} (part ${partNo} of ${parts.length})` : script.title;
    const asset = await prisma.studioAsset.create({
      data: { workspaceId: doc.workspaceId, title, type: 'AUDIO', content: content as unknown as Prisma.InputJsonObject },
      select: { id: true },
    });

    await recordUsage(user.id, 'audio_script');
    recordMetric(user.id, 'generate_asset').catch((e) => console.error('Metric failed:', e));
    return NextResponse.json({ id: asset.id, minutes, format: chosen, tierAdjusted: tier !== wantedTier ? tier : null, parts: parts.length });
  } catch (error) {
    console.error('Audio POST error:', error);
    return NextResponse.json({ error: 'Could not make this audio overview. Please try again.' }, { status: 500 });
  }
}
