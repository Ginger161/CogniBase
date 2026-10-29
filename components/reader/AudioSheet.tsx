'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Headphones, Loader2, Pause, Play, RotateCcw, RotateCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Sheet from '@/components/ui/Sheet';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { removeAudioOffline, saveAudioOffline, savedAudioUrl } from '@/lib/offline';
import { FORMAT_INFO, GOAL_INFO, type AudioFormat, type AudioGoal, type LengthTier } from '@/lib/audio/formats';

type Turn = { speaker: 'A' | 'B'; text: string; recall?: boolean };
type Episode = {
  id: string;
  title: string;
  format: AudioFormat | null;
  minutes: number | null;
  part: { index: number; total: number } | null;
  turns: Turn[];
  chapters: { title: string; startTurn: number }[];
  starts: number[] | null;
  durationSec: number | null;
  audioUrl: string | null;
  audioNote: string | null;
};
type Listing = {
  episodes: Episode[];
  voicesOn: boolean;
  plan: { label: string; maxEpisodeMinutes: number; series: boolean; download: boolean };
  parts: number;
};

const RECALL_SECONDS = 5;
const SPEEDS = [1, 1.25, 1.5, 2];
const TIERS: LengthTier[] = [5, 10, 15];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const chip = (active: boolean, disabled = false) =>
  `min-h-11 px-4 rounded-full text-[13px] font-semibold border whitespace-nowrap ${
    active ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)] text-[var(--on-accent)]' : 'border-[var(--border-strong)] text-[var(--text-secondary)]'
  } ${disabled ? 'opacity-40' : ''}`;

function Player({ episode, canDownload }: { episode: Episode; canDownload: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(episode.durationSec ?? 0);
  const [speed, setSpeed] = useState(1);
  const [pauses, setPauses] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const handled = useRef(new Set<number>());
  const counted = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const starts = useMemo(() => episode.starts ?? [], [episode.starts]);
  // Each recall question ends where the next turn begins; that is where the player waits for the listener.
  const recallStops = episode.turns.flatMap((t, i) => (t.recall && starts[i + 1] !== undefined ? [{ turn: i, at: starts[i + 1] }] : []));
  const current = starts.length ? Math.max(0, starts.findLastIndex((s) => s <= time + 0.05)) : -1;

  const seek = useCallback((to: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || to, to));
    // Anything ahead of the new position may pause again.
    handled.current = new Set([...handled.current].filter((i) => (starts[i + 1] ?? 0) <= a.currentTime));
  }, [starts]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  // Recall pauses: stop at the end of a question, count down, then carry on.
  const endCountdown = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setCountdown(null);
    void audioRef.current?.play();
  }, []);

  const startCountdown = useCallback(() => {
    let remaining = RECALL_SECONDS;
    setCountdown(remaining);
    timer.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) endCountdown();
      else setCountdown(remaining);
    }, 1000);
  }, [endCountdown]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  // Lock-screen and headphone controls, which matter when the phone is in a pocket.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: episode.title, artist: 'CogniBase' });
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('seekbackward', () => seek((audioRef.current?.currentTime ?? 0) - 15));
    navigator.mediaSession.setActionHandler('seekforward', () => seek((audioRef.current?.currentTime ?? 0) + 15));
    return () => {
      for (const a of ['play', 'pause', 'seekbackward', 'seekforward'] as const) navigator.mediaSession.setActionHandler(a, null);
    };
  }, [episode.title, toggle, seek]);

  const onTime = () => {
    const a = audioRef.current;
    if (!a) return;
    setTime(a.currentTime);
    if (!pauses || countdown !== null) return;
    const stop = recallStops.find((s) => !handled.current.has(s.turn) && a.currentTime >= s.at - 0.25 && a.currentTime < s.at + 1.5);
    if (stop) {
      handled.current.add(stop.turn);
      a.pause();
      startCountdown();
    }
  };

  const onPlay = () => {
    setPlaying(true);
    if (!counted.current) {
      counted.current = true;
      fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ action: 'listen_audio' }) }).catch(() => {});
    }
  };

  // Is this episode already saved on the device? If so, play from there and skip the data.
  useEffect(() => {
    let cancelled = false;
    savedAudioUrl(episode.id).then((url) => !cancelled && setOfflineUrl(url));
    return () => {
      cancelled = true;
    };
  }, [episode.id]);

  const toggleOffline = async () => {
    if (saving || !episode.audioUrl) return;
    setSaving(true);
    if (offlineUrl) {
      await removeAudioOffline(episode.id);
      setOfflineUrl(null);
    } else {
      const url = await saveAudioOffline(episode.id, episode.audioUrl);
      if (url) setOfflineUrl(url);
      else toast.error('Could not save this to your device. Check your connection and storage space.');
    }
    setSaving(false);
  };

  const btn = 'w-11 h-11 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]';

  return (
    <div className="flex flex-col gap-4">
      <audio
        ref={audioRef}
        src={offlineUrl ?? episode.audioUrl ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || duration)}
        onTimeUpdate={onTime}
        onPlay={onPlay}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div className="rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)] p-4 flex flex-col gap-3">
        {countdown !== null && (
          <div role="status" className="rounded-xl bg-[var(--tag-bg)] px-3 py-2.5 flex items-center gap-3">
            <span className="text-2xl font-black tabular-nums text-[var(--accent-text)]">{countdown}</span>
            <span className="flex-1 text-sm font-semibold">Your turn. Answer in your head.</span>
            <button type="button" onClick={endCountdown} className="min-h-11 px-3 text-sm font-semibold underline">
              Skip
            </button>
          </div>
        )}

        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={0.5}
          value={Math.min(time, duration || time)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="w-full h-11 accent-[var(--accent-solid)]"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)] tabular-nums -mt-2">
          <span>{clock(time)}</span>
          <span>{clock(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} className="min-h-11 min-w-11 px-2 text-sm font-bold tabular-nums" aria-label={`Speed ${speed}x. Change speed`}>
            {speed}x
          </button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => seek((audioRef.current?.currentTime ?? 0) - 15)} aria-label="Back 15 seconds" className={btn}>
              <RotateCcw size={20} aria-hidden />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
              className="w-14 h-14 rounded-full bg-[var(--accent-solid)] text-[var(--on-accent)] flex items-center justify-center"
            >
              {playing ? <Pause size={24} fill="currentColor" aria-hidden /> : <Play size={24} fill="currentColor" aria-hidden />}
            </button>
            <button type="button" onClick={() => seek((audioRef.current?.currentTime ?? 0) + 15)} aria-label="Forward 15 seconds" className={btn}>
              <RotateCw size={20} aria-hidden />
            </button>
          </div>
          {canDownload && episode.audioUrl ? (
            <button
              type="button"
              onClick={toggleOffline}
              disabled={saving}
              aria-pressed={!!offlineUrl}
              aria-label={offlineUrl ? 'Saved on this device. Remove it' : 'Save on this device for offline listening'}
              className={`${btn} ${offlineUrl ? 'text-[var(--accent-text)]' : ''}`}
            >
              {saving ? <Loader2 size={20} className="animate-spin" aria-hidden /> : offlineUrl ? <Check size={20} aria-hidden /> : <Download size={20} aria-hidden />}
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>

        {recallStops.length > 0 && (
          <label className="flex items-center gap-2.5 min-h-11 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={pauses} onChange={(e) => setPauses(e.target.checked)} className="w-5 h-5 accent-[var(--accent-solid)]" />
            Pause for me to answer the questions
          </label>
        )}
      </div>

      {episode.chapters.length > 1 && starts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1" role="group" aria-label="Chapters">
          {episode.chapters.map((c) => (
            <button
              key={`${c.startTurn}-${c.title}`}
              type="button"
              onClick={() => {
                seek(starts[c.startTurn] ?? 0);
                void audioRef.current?.play();
              }}
              className={chip(current >= c.startTurn && (episode.chapters.find((n) => n.startTurn > c.startTurn)?.startTurn ?? Infinity) > current)}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      <Transcript turns={episode.turns} current={current} onJump={starts.length ? (i) => seek(starts[i] ?? 0) : undefined} />
    </div>
  );
}

function Transcript({ turns, current, onJump }: { turns: Turn[]; current: number; onJump?: (turn: number) => void }) {
  return (
    <ol className="flex flex-col gap-2.5" aria-label="Transcript">
      {turns.map((t, i) => {
        const Tag = onJump ? 'button' : 'div';
        return (
          <li key={i}>
            <Tag
              {...(onJump ? { type: 'button' as const, onClick: () => onJump(i) } : {})}
              className={`w-full text-left rounded-xl px-3 py-2 text-[15px] leading-relaxed ${
                i === current ? 'bg-[var(--tag-bg)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-xs font-bold tracking-wider uppercase text-[var(--accent-text)] mr-2">{t.speaker === 'A' ? 'Host 1' : 'Host 2'}</span>
              {t.recall && <span className="text-xs font-bold text-[var(--accent-text)] mr-2">Question</span>}
              {t.text}
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}

export default function AudioSheet({ open, onClose, documentId, documentName }: { open: boolean; onClose: () => void; documentId: string; documentName: string }) {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<AudioGoal>('learn');
  const [length, setLength] = useState<LengthTier>(10);
  const [format, setFormat] = useState<AudioFormat | 'auto'>('auto');
  const [step, setStep] = useState<null | 'script' | 'voice'>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/audio?documentId=${encodeURIComponent(documentId)}`);
      if (!res.ok) throw await readApiError(res, 'Could not load your audio overviews.');
      const d: Listing = await res.json();
      setData(d);
      setError(null);
      return d;
    } catch (e) {
      setError(friendlyError(e, 'Could not load your audio overviews.'));
      return null;
    }
  }, [documentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the saved overviews whenever the sheet opens
    if (open) void load();
  }, [open, load]);

  const voice = async (id: string) => {
    setStep('voice');
    try {
      const res = await fetch('/api/audio/synthesize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: id }) });
      if (!res.ok) throw await readApiError(res, 'Voices could not be added just now.');
    } catch (e) {
      // Not a failure: the transcript is already saved, and the message says what to do.
      toast(friendlyError(e, 'Voices could not be added just now.'), { duration: 8000 });
    } finally {
      setStep(null);
      await load();
    }
  };

  const make = async () => {
    setStep('script');
    try {
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, goal, length, format: format === 'auto' ? undefined : format }),
      });
      if (!res.ok) throw await readApiError(res, 'Could not make this audio overview.');
      const made = await res.json();
      const d = await load();
      setOpenId(made.id);
      if (made.tierAdjusted) toast(`This source supports about ${made.tierAdjusted} minutes without padding, so that is what you got.`);
      if (d?.voicesOn && !made.cached) await voice(made.id);
      else setStep(null);
    } catch (e) {
      setStep(null);
      toast.error(friendlyError(e, 'Could not make this audio overview.'));
    }
  };

  const busy = step !== null;

  return (
    <Sheet open={open} onClose={onClose} title="Audio overview">
      <div className="flex flex-col gap-6 pt-2">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Two hosts talk you through <span className="text-[var(--text-primary)] font-semibold">{documentName}</span>, made for listening on the move.
        </p>

        <section className="flex flex-col gap-4" aria-label="Make a new overview">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Your goal</span>
            <div role="radiogroup" aria-label="Goal" className="flex flex-wrap gap-2">
              {(Object.keys(GOAL_INFO) as AudioGoal[]).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={goal === g} onClick={() => setGoal(g)} className={chip(goal === g)}>
                  {GOAL_INFO[g].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">{GOAL_INFO[goal].blurb}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Length</span>
            <div role="radiogroup" aria-label="Length" className="flex flex-wrap gap-2">
              {TIERS.map((t) => {
                const locked = !!data && t > data.plan.maxEpisodeMinutes;
                return (
                  <button key={t} type="button" role="radio" aria-checked={length === t} disabled={locked} onClick={() => setLength(t)} className={chip(length === t, locked)}>
                    {t} min
                  </button>
                );
              })}
            </div>
            {data && data.plan.maxEpisodeMinutes < 15 && (
              <p className="text-xs text-[var(--text-muted)]">Your {data.plan.label} plan goes up to {data.plan.maxEpisodeMinutes} minutes.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Style</span>
            <div role="radiogroup" aria-label="Style" className="flex flex-wrap gap-2">
              <button type="button" role="radio" aria-checked={format === 'auto'} onClick={() => setFormat('auto')} className={chip(format === 'auto')}>
                Surprise me
              </button>
              {(Object.keys(FORMAT_INFO) as AudioFormat[]).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)} className={chip(format === f)}>
                  {FORMAT_INFO[f].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {format === 'auto' ? 'Picks a different style each time so episodes never sound the same.' : FORMAT_INFO[format].blurb}
            </p>
          </div>

          {data && data.parts > 1 && (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {data.plan.series
                ? `This is a long source, so it becomes a series of ${data.parts} parts. Make them one at a time.`
                : 'This is a long source. Your plan covers the first part; a series of all parts comes with X.'}
            </p>
          )}

          <button
            type="button"
            onClick={make}
            disabled={busy}
            className="h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
            {step === 'script' ? 'Writing the script…' : step === 'voice' ? 'Adding the voices…' : 'Make audio overview'}
          </button>
          {step === 'script' && <p className="text-xs text-[var(--text-muted)] -mt-3">This can take a minute or two for a longer episode. You can leave this open.</p>}
          {data && !data.voicesOn && <p className="text-xs text-[var(--text-muted)] -mt-3">Voices are not switched on yet, so you will get the transcript to read.</p>}
        </section>

        {error && (
          <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {data && data.episodes.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Your overviews">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Your overviews</h3>
            <ul className="flex flex-col gap-2">
              {data.episodes.map((ep) => {
                const isOpen = openId === ep.id;
                return (
                  <li key={ep.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
                    <button type="button" onClick={() => setOpenId(isOpen ? null : ep.id)} aria-expanded={isOpen} className="w-full min-h-14 px-4 py-3 flex items-center gap-3 text-left">
                      <span className="w-10 h-10 rounded-xl bg-[var(--tag-bg)] flex items-center justify-center shrink-0">
                        <Headphones size={18} className="text-[var(--accent-text)]" aria-hidden />
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold truncate">{ep.title}</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {[ep.format ? FORMAT_INFO[ep.format].label : null, ep.minutes ? `about ${Math.round(ep.minutes)} min` : null, ep.audioUrl ? 'Audio' : 'Transcript'].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 flex flex-col gap-3">
                        {ep.audioNote && !ep.audioUrl && <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{ep.audioNote}</p>}
                        {!ep.audioUrl && data.voicesOn && (
                          <button type="button" onClick={() => voice(ep.id)} disabled={busy} className="h-11 rounded-xl border border-[var(--border-strong)] text-sm font-semibold disabled:opacity-60">
                            Add voices
                          </button>
                        )}
                        {ep.audioUrl ? <Player episode={ep} canDownload={data.plan.download} /> : <Transcript turns={ep.turns} current={-1} />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
}
