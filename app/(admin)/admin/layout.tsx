import AdminShell from '@/components/admin/AdminShell';
import { can, requireStaffPage } from '@/lib/admin';
import { ADMIN_SECTIONS } from '@/lib/staff';

export const dynamic = 'force-dynamic';

// Everything under /admin goes through here. Anyone who is not on the team is sent to their own dashboard,
// and a team member only ever sees the sections they have been given.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const sections = ADMIN_SECTIONS.filter((s) => (s.permission === 'owner' ? staff.role === 'OWNER' : can(staff, s.permission))).map(({ href, label }) => ({ href, label }));
  return (
    <AdminShell sections={sections} email={staff.email} role={staff.role}>
      {children}
    </AdminShell>
  );
}
