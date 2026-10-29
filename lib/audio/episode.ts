import type { SupabaseClient } from '@supabase/supabase-js';
import type { Chapter, Turn } from './script';
import type { AudioFormat, AudioGoal, LengthTier } from './formats';
import { TtsError, getTtsProvider, synthesizeEpisode } from './tts';

const BUCKET = 'workspace-files';

/** What is saved in StudioAsset.content for an AUDIO asset. */
export type EpisodeContent = {
  documentId: string;
  turns: Turn[];
  chapters: Chapter[];
  format: AudioFormat;
  goal: AudioGoal;
  tier: LengthTier;
  /** Spoken length estimated from the script, in minutes. */
  minutes: number;
  charCount: number;
  /** Fingerprint of the source text plus the settings, so the same request is never paid for twice. */
  key: string;
  part?: { index: number; total: number };
  audioPath?: string;
  /** Seconds into the audio at which each turn starts, and the total length. Present once voiced. */
  starts?: number[];
  durationSec?: number;
  /** Why there is no audio yet, in words the student can act on. */
  audioNote?: string;
};

export function isEpisodeContent(x: unknown): x is EpisodeContent {
  const c = x as EpisodeContent | null;
  return !!c && typeof c.documentId === 'string' && Array.isArray(c.turns);
}

/** Voices the script and stores the MP3 under the student's own folder. Never throws: a failure becomes a note. */
export async function addVoices(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
  turns: Turn[]
): Promise<{ audioPath?: string; starts?: number[]; durationSec?: number; audioNote?: string }> {
  const provider = getTtsProvider();
  if (!provider) {
    return { audioNote: 'Voices are not switched on yet, so this is a transcript for now. Voices can be added later without losing it.' };
  }
  try {
    const { audio, durations } = await synthesizeEpisode(turns, provider);
    const path = `${userId}/audio/${assetId}.mp3`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, audio, { contentType: 'audio/mpeg', upsert: true });
    if (error) {
      console.error('Audio upload failed:', error);
      return { audioNote: 'The audio was made but could not be saved. Try adding voices again.' };
    }
    let at = 0;
    const starts = durations.map((d) => {
      const start = at;
      at += d;
      return Math.round(start * 10) / 10;
    });
    return { audioPath: path, starts, durationSec: Math.round(at) };
  } catch (e) {
    if (e instanceof TtsError) {
      const advice = e.kind === 'quota' ? ' Try again later.' : e.kind === 'auth' ? ' The site owner needs to check the voice key.' : ' Try again in a moment.';
      return { audioNote: `${e.message}${advice} Your transcript is saved.` };
    }
    console.error('Voicing failed:', e);
    return { audioNote: 'Voices could not be added just now. Your transcript is saved.' };
  }
}

export async function signedAudioUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export async function removeAudio(supabase: SupabaseClient, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]).catch((e) => console.error('Audio cleanup failed:', e));
}
