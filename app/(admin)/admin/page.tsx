import Link from 'next/link';
import Overview from '@/components/admin/Overview';
import { can, requireStaffPage } from '@/lib/admin';
import { ADMIN_SECTIONS } from '@/lib/staff';

export const dynamic = 'force-dynamic';

// The admin home. Anyone with the Overview permission sees the numbers; everyone else on the team lands on a
// short list of exactly the sections they have been given.
export default async function AdminHome() {
  const staff = await requireStaffPage();
  if (can(staff, 'overview.view')) return <Overview />;

  const mine = ADMIN_SECTIONS.filter((s) => s.href !== '/admin' && (s.permission === 'owner' ? staff.role === 'OWNER' : can(staff, s.permission)));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] font-bold tracking-tight">Welcome</h1>
      {mine.length === 0 ? (
        <p className="text-[var(--text-secondary)]">You are on the team, but no sections have been turned on for you yet. Ask the owner.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="min-h-14 px-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center font-semibold hover:border-[var(--accent-solid)]">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
