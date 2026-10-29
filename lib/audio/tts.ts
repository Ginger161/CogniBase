import type { Turn } from './script';

/**
 * Voice providers sit behind this small interface so the engine never depends on one vendor.
 * With no key configured there is no provider and episodes are saved as a script only, which costs nothing.
 */
export type TtsProvider = { name: string; synthesize: (text: string, speaker: Turn['speaker']) => Promise<Buffer> };

/** A failure with a message that is safe to show to the person using the app. */
export class TtsError extends Error {
  readonly kind: 'quota' | 'auth' | 'unavailable';
  constructor(message: string, kind: 'quota' | 'auth' | 'unavailable') {
    super(message);
    this.kind = kind;
  }
}

// Premade ElevenLabs voices, so a free account can use them. Override with ELEVENLABS_VOICE_A / _B.
const DEFAULT_VOICES = { A: '21m00Tcm4TlvDq8ikWAM', B: 'pNInz6obpgDQGcFmaJgB' };

function elevenLabs(apiKey: string): TtsProvider {
  const model = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5'; // the cheapest model per character
  const voices = {
    A: process.env.ELEVENLABS_VOICE_A || DEFAULT_VOICES.A,
    B: process.env.ELEVENLABS_VOICE_B || DEFAULT_VOICES.B,
  };
  return {
    name: 'elevenlabs',
    async synthesize(text, speaker) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voices[speaker]}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: model }),
        signal: AbortSignal.timeout(30_000),
      }).catch(() => {
        throw new TtsError('The voice service could not be reached.', 'unavailable');
      });
      if (res.status === 401) throw new TtsError('The voice service key is not valid.', 'auth');
      if (res.status === 402 || res.status === 429) throw new TtsError('The voice allowance has been used up for now.', 'quota');
      if (!res.ok) throw new TtsError('The voice service had a problem.', 'unavailable');
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

/** The active provider, or null when audio is switched off or no key is set. */
export function getTtsProvider(): TtsProvider | null {
  if (process.env.AUDIO_PROVIDER === 'off') return null;
  const key = process.env.ELEVENLABS_API_KEY;
  return key ? elevenLabs(key) : null;
}

/** 64 kbps constant-bit-rate MP3, so a part's length in seconds follows exactly from its size in bytes. */
export const MP3_BITRATE = 64_000;
export const secondsOf = (bytes: number) => (bytes * 8) / MP3_BITRATE;

/** Voices every turn (a few at a time) and joins the MP3 parts in order, with how long each part runs. */
export async function synthesizeEpisode(turns: Turn[], provider: TtsProvider): Promise<{ audio: Buffer; durations: number[] }> {
  const parts: Buffer[] = new Array(turns.length);
  let next = 0;
  const worker = async () => {
    while (next < turns.length) {
      const i = next++;
      parts[i] = await provider.synthesize(turns[i].text, turns[i].speaker);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, turns.length) }, worker));
  return { audio: Buffer.concat(parts), durations: parts.map((p) => secondsOf(p.length)) };
}
