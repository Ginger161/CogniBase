'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Sheet from '@/components/ui/Sheet';

const FORMATS = ['Multiple Choice', 'Written Essay', 'General Knowledge'];
const TIMEFRAMES = ['Cramming (<24h)', 'Standard', 'Deep Study'];
const LEVELS = ['Beginner', 'Intermediate', 'Expert'];

function Choice({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
      <legend className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)] mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o)}
              className={`h-11 px-4 rounded-full text-sm font-semibold border transition-colors ${
                active
                  ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)] text-[var(--on-accent)]'
                  : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Builds a guide from one source, saves it, then opens it in Study. */
export default function StudyGuideSheet({ source, onClose }: { source: { id: string; name: string } | null; onClose: () => void }) {
  const router = useRouter();
  const [format, setFormat] = useState(FORMATS[2]);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[1]);
  const [level, setLevel] = useState(LEVELS[1]);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!source || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/engine/generate-study-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: source.id,
          sectionConstraint: `Format: ${format} | Timeframe: ${timeframe} | Level: ${level}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.guide?.id) throw new Error(data.error || 'Could not generate the study guide.');
      onClose();
      router.push(`/study-guides?open=${encodeURIComponent(data.guide.id)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the study guide.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!source}
      onClose={busy ? () => {} : onClose}
      title="Study guide"
      footer={
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="w-full h-12 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden /> Building your guide…
            </>
          ) : (
            'Generate guide'
          )}
        </button>
      }
    >
      <p className="text-sm text-[var(--text-secondary)] mb-5 truncate">From {source?.name}</p>
      <div className="flex flex-col gap-5">
        <Choice label="Target format" options={FORMATS} value={format} onChange={setFormat} />
        <Choice label="Timeframe" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
        <Choice label="Current level" options={LEVELS} value={level} onChange={setLevel} />
      </div>
    </Sheet>
  );
}
