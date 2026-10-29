import { can, requireStaffPage } from '@/lib/admin';
import Users from '@/components/admin/Users';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const staff = await requireStaffPage('users.view');
  return <Users canEdit={can(staff, 'users.edit')} />;
}
