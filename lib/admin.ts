import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { requireUser } from '@/lib/api-auth';
import { ALL_PERMISSIONS, isPermission, type Permission } from '@/lib/staff';

export type Staff = {
  userId: string;
  email: string;
  role: 'OWNER' | 'MOD';
  permissions: Set<Permission>;
};

/** The owners: a comma-separated list in ADMIN_EMAILS. Owners can do everything and manage the team. */
function ownerEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && ownerEmails().includes(email.toLowerCase());
}

/** Is this signed-in person on the team, and with what powers? Null for every ordinary student. */
export async function getStaff(user: { id: string; email?: string | null }): Promise<Staff | null> {
  const email = (user.email ?? '').toLowerCase();
  if (isOwnerEmail(email)) return { userId: user.id, email, role: 'OWNER', permissions: new Set(ALL_PERMISSIONS) };

  const row = await prisma.staffMember.findUnique({ where: { userId: user.id }, select: { permissions: true } }).catch(() => null);
  if (!row) return null;
  return { userId: user.id, email, role: 'MOD', permissions: new Set(row.permissions.filter(isPermission)) };
}

export const can = (staff: Staff, permission: Permission) => staff.permissions.has(permission);

/** For API routes. Anyone who is not allowed gets a plain 404, so the admin routes do not announce themselves. */
export async function requireStaff(permission?: Permission) {
  const { user, response } = await requireUser();
  if (!user) return { user: null, staff: null, response };
  const staff = await getStaff(user);
  if (!staff || (permission && !can(staff, permission))) {
    return { user: null, staff: null, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { user, staff, response: null };
}

/** For API routes only the owner may use (managing the team). */
export async function requireOwner() {
  const result = await requireStaff();
  if (!result.staff || result.staff.role !== 'OWNER') {
    return { user: null, staff: null, response: result.response ?? NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return result;
}

/**
 * For admin pages. Students never see anything: they are sent to their own dashboard. A team member who opens a
 * page they have no access to is sent to their own admin home instead.
 */
export async function requireStaffPage(permission?: Permission | 'owner'): Promise<Staff> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const staff = await getStaff(data.user);
  if (!staff) redirect('/dashboard');
  if (permission === 'owner' && staff.role !== 'OWNER') redirect('/admin');
  if (permission && permission !== 'owner' && !can(staff, permission)) redirect('/admin');
  return staff;
}
