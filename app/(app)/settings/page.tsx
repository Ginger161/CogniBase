'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { writeThemeCookie } from '@/lib/theme-cookie';
import { Download, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase/client';
import { useUserContext } from '@/lib/hooks/useUserContext';
import { formatSmartTime } from '@/lib/utils/time';
import Sheet from '@/components/ui/Sheet';

type AuditLog = { id: string; action: string; details: string; location: string | null; createdAt: string };

const THEMES = [
  { id: 'charcoal', label: 'Charcoal', hint: 'Default' },
  { id: 'dark', label: 'Black', hint: 'OLED' },
  { id: 'ivory', label: 'Ivory', hint: 'Light' },
];

const card = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 flex flex-col gap-4';
const input =
  'w-full h-12 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-strong)] px-4 text-[15px] outline-none focus:border-[var(--accent-solid)] placeholder:text-[var(--text-muted)] disabled:opacity-60';
const primaryBtn = 'h-12 px-6 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold disabled:opacity-60 flex items-center justify-center gap-2';
const ghostBtn = 'h-12 px-5 rounded-xl border border-[var(--border-strong)] font-semibold flex items-center justify-center gap-2 disabled:opacity-60';

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { context, mutate } = useUserContext();

  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');
  const [goal, setGoal] = useState('120');
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  // Fill the form once, when the profile first arrives.
  useEffect(() => {
    if (!context || seeded) return;
    /* eslint-disable react-hooks/set-state-in-effect -- seed the form from the loaded profile */
    setName(context.name ?? '');
    setSchool(context.school ?? '');
    setDepartment(context.department ?? '');
    setGoal(String(context.preferences?.dailyFocusGoal ?? 120));
    setSeeded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [context, seeded]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/audit-logs')
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => !cancelled && setLogs(Array.isArray(d) ? d : []))
      .catch(() => !cancelled && setLogs([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const goalNumber = Number.parseInt(goal, 10);
    if (!name.trim()) return toast.error('Add a display name.');
    if (!Number.isFinite(goalNumber) || goalNumber < 10 || goalNumber > 720) return toast.error('Pick a daily focus goal between 10 and 720 minutes.');

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim(), school: school.trim(), department: department.trim(), preferences: { dailyFocusGoal: goalNumber } }),
      });
      if (!res.ok) throw new Error();
      toast.success('Saved');
      await mutate();
    } catch {
      toast.error('Could not save your settings.');
    } finally {
      setSaving(false);
    }
  };

  const chooseTheme = (id: string) => {
    setTheme(id);
    writeThemeCookie(id);
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { theme: id } }),
    }).catch(() => {});
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error('Use at least 8 characters.');
    if (newPassword !== confirmPassword) return toast.error('The passwords do not match.');
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated');
      fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', details: 'Changed account password' }),
      }).catch(() => {});
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const signOut = async () => {
    await fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign_out', details: 'Signed out' }),
    }).catch(() => {});
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/settings/export');
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cognibase-data-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export your data. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/settings/account', { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Deletion failed.');
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete your account.');
      setDeleting(false);
    }
  };

  const email = context?.email ?? '';

  return (
    <div className="max-w-xl mx-auto px-5 pt-2 md:pt-8 pb-10 flex flex-col gap-5">
      <h1 className="text-[28px] font-bold tracking-tight">Settings</h1>

      <form onSubmit={save} className={card} aria-labelledby="profile-h">
        <h2 id="profile-h" className="text-base font-bold">
          Profile
        </h2>
        <Field id="name" label="Display name">
          <input id="name" className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        </Field>
        <Field id="email" label="Email">
          <input id="email" className={input} value={email} disabled readOnly />
        </Field>
        <Field id="school" label="School">
          <input id="school" className={input} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Veritas University" />
        </Field>
        <Field id="department" label="Department">
          <input id="department" className={input} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Educational Management" />
        </Field>
        <Field id="goal" label="Daily focus goal (minutes)">
          <input id="goal" className={input} type="number" inputMode="numeric" min={10} max={720} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden />}
          Save changes
        </button>
      </form>

      <section className={card} aria-labelledby="look-h">
        <h2 id="look-h" className="text-base font-bold">
          Appearance
        </h2>
        <div role="radiogroup" aria-labelledby="look-h" className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => chooseTheme(t.id)}
              className={`min-h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 ${
                theme === t.id ? 'border-[var(--accent-solid)] bg-[var(--tag-bg)]' : 'border-[var(--border-strong)]'
              }`}
            >
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-xs text-[var(--text-muted)]">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={card} aria-labelledby="account-h">
        <h2 id="account-h" className="text-base font-bold">
          Account
        </h2>
        <form onSubmit={changePassword} className="flex flex-col gap-3">
          <Field id="new-password" label="New password">
            <input id="new-password" className={input} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field id="confirm-password" label="Confirm new password">
            <input id="confirm-password" className={input} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
          <button type="submit" disabled={changingPassword || !newPassword} className={ghostBtn}>
            {changingPassword && <Loader2 size={16} className="animate-spin" aria-hidden />}
            Update password
          </button>
        </form>
        <hr className="border-[var(--border-color)]" />
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={exportData} disabled={exporting} className={`${ghostBtn} sm:flex-1`}>
            {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
            Export my data
          </button>
          <button type="button" onClick={signOut} className={`${ghostBtn} sm:flex-1`}>
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      </section>

      <section className={card} aria-labelledby="activity-h">
        <h2 id="activity-h" className="text-base font-bold">
          Recent activity
        </h2>
        {logs === null ? (
          <div className="h-16 rounded-xl bg-[var(--bg-surface-alt)] animate-pulse" aria-busy="true" />
        ) : logs.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 border-t border-[var(--border-color)] first:border-t-0">
                <span className="text-sm">{l.details}</span>
                <span className="text-xs text-[var(--text-muted)] shrink-0">{formatSmartTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--danger)]/30 p-5 flex flex-col gap-3" aria-labelledby="danger-h">
        <h2 id="danger-h" className="text-base font-bold text-[var(--danger)]">
          Delete account
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          This permanently deletes your profile, library, uploaded files, study guides and progress. It cannot be undone.
        </p>
        <button type="button" onClick={() => setDeleteOpen(true)} className="h-12 rounded-xl border border-[var(--danger)]/50 text-[var(--danger)] font-semibold">
          Delete my account
        </button>
      </section>

      <Sheet
        open={deleteOpen}
        onClose={() => (deleting ? undefined : setDeleteOpen(false))}
        title="Delete your account?"
        footer={
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting || !email || deleteConfirm !== email}
            className="w-full h-12 rounded-xl bg-[var(--danger)] text-[#1A0505] font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {deleting && <Loader2 size={16} className="animate-spin" aria-hidden />}
            Delete everything
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Type <strong className="text-[var(--text-primary)]">{email}</strong> to confirm.
          </p>
          <label htmlFor="delete-confirm" className="sr-only">
            Type your email to confirm
          </label>
          <input id="delete-confirm" className={input} value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
        </div>
      </Sheet>
    </div>
  );
}
