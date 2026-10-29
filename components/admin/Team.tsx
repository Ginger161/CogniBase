'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError, readApiError } from '@/lib/client-errors';
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_PRESETS, type Permission } from '@/lib/staff';
import { ErrorBox, Loading, PageTitle, card, field, ghostBtn, primaryBtn, useApi } from './ui';

type Member = { userId: string; email: string; name: string | null; permissions: string[] };

function PermissionBoxes({ value, onChange }: { value: Permission[]; onChange: (next: Permission[]) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-x-4">
      {ALL_PERMISSIONS.map((p) => (
        <label key={p} className="flex items-start gap-3 min-h-11 py-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(p)}
            onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))}
            className="w-5 h-5 mt-0.5 accent-[var(--accent-solid)]"
          />
          <span className="flex flex-col">
            <span className="font-semibold">{PERMISSIONS[p].label}</span>
            <span className="text-xs text-[var(--text-secondary)]">{PERMISSIONS[p].hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** Owner only: add moderators, choose exactly what each one can see and do, remove them. */
export default function Team() {
  const { data, error, reload } = useApi<{ team: Member[] }>('/api/admin/team');
  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState<Permission[]>([]);
  const [edits, setEdits] = useState<Record<string, Permission[]>>({});
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const save = async (address: string, permissions: Permission[]) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, permissions }) });
      if (!res.ok) throw await readApiError(res, 'Could not save that.');
      toast.success('Saved.');
      return true;
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save that.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Member) => {
    try {
      const res = await fetch(`/api/admin/team?userId=${encodeURIComponent(m.userId)}`, { method: 'DELETE' });
      if (!res.ok) throw await readApiError(res, 'Could not remove them.');
      await reload();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not remove them.'));
    }
  };

  return (
    <>
      <PageTitle title="Team" hint="You are the owner and see everything. Moderators see only the sections you tick, and they never see chats or study material." />

      <section className={`${card} flex flex-col gap-3`} aria-label="Add a moderator">
        <h2 className="text-sm font-semibold">Add a moderator</h2>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their account email (they must have signed up)" className={field} aria-label="Moderator email" autoComplete="off" />
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
            <button key={key} type="button" className={ghostBtn} onClick={() => setPerms(preset.permissions)}>
              {preset.label} preset
            </button>
          ))}
        </div>
        <PermissionBoxes value={perms} onChange={setPerms} />
        <button
          type="button"
          disabled={busy || !email.trim() || perms.length === 0}
          className={primaryBtn}
          onClick={async () => {
            if (await save(email.trim(), perms)) {
              setEmail('');
              setPerms([]);
              await reload();
            }
          }}
        >
          Add moderator
        </button>
      </section>

      <ul className="flex flex-col gap-3">
        {data.team.map((m) => {
          const current = (edits[m.userId] ?? m.permissions) as Permission[];
          const changed = !!edits[m.userId];
          return (
            <li key={m.userId} className={`${card} flex flex-col gap-3`}>
              <div className="flex items-center gap-3">
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[15px] font-semibold truncate">{m.name || m.email}</span>
                  <span className="text-xs text-[var(--text-secondary)] truncate">{m.email}</span>
                </span>
                <button type="button" onClick={() => remove(m)} aria-label={`Remove ${m.email}`} className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]">
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
              <PermissionBoxes value={current} onChange={(next) => setEdits({ ...edits, [m.userId]: next })} />
              {changed && (
                <button
                  type="button"
                  disabled={busy}
                  className={primaryBtn}
                  onClick={async () => {
                    if (await save(m.email, current)) {
                      setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== m.userId)));
                      await reload();
                    }
                  }}
                >
                  Save changes
                </button>
              )}
            </li>
          );
        })}
        {data.team.length === 0 && <li className="text-sm text-[var(--text-secondary)] py-6 text-center">No moderators yet.</li>}
      </ul>
    </>
  );
}
