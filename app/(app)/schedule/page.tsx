'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useSchedule } from '@/components/schedule/useSchedule';
import CoursesSection from '@/components/schedule/CoursesSection';
import TimetableSection from '@/components/schedule/TimetableSection';
import ExamsSection from '@/components/schedule/ExamsSection';

function ScheduleInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const tab = tabParam === 'courses' ? 'courses' : tabParam === 'exams' ? 'exams' : 'timetable';
  const s = useSchedule();

  return (
    <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 pb-10 flex flex-col gap-4">
      <div className="flex items-center gap-1 -ml-2">
        <Link href="/vault" aria-label="Back to Library" className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ChevronLeft size={22} aria-hidden />
        </Link>
        <h1 className="text-[28px] font-bold tracking-tight">Schedule</h1>
      </div>

      <div role="tablist" aria-label="Schedule sections" className="flex gap-1 p-1 rounded-xl bg-[var(--bg-surface-alt)]">
        {([
          ['timetable', 'Timetable'],
          ['courses', 'Courses'],
          ['exams', 'Exams'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => router.replace(id === 'timetable' ? '/schedule' : `/schedule?tab=${id}`)}
            className={`flex-1 h-11 rounded-lg text-sm font-semibold ${tab === id ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'exams' ? (
        <ExamsSection />
      ) : s.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your schedule">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-[var(--bg-surface)] animate-pulse" />
          ))}
        </div>
      ) : s.loadError ? (
        <div role="alert" className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 flex items-center gap-3">
          <p className="flex-1 text-sm text-[var(--danger)]">{s.loadError}</p>
          <button type="button" onClick={s.reload} className="min-h-11 px-3 text-sm font-semibold underline">
            Retry
          </button>
        </div>
      ) : tab === 'courses' ? (
        <CoursesSection courses={s.courses} busy={s.busy} onExtract={s.extractCourses} onAdd={s.addCourse} onRemove={s.removeCourses} />
      ) : (
        <TimetableSection
          classes={s.classes}
          busy={s.busy}
          pendingClashes={s.pendingClashes}
          onExtract={s.extractTimetable}
          onSave={s.saveClass}
          onRemove={s.removeClasses}
          onClear={s.clearClasses}
          onKeepClashes={s.keepClashes}
          onDiscardClashes={s.discardClashes}
        />
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-5 pt-8 text-[var(--text-secondary)]">Loading…</div>}>
      <ScheduleInner />
    </Suspense>
  );
}
