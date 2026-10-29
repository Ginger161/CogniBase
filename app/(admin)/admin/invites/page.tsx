import { requireStaffPage } from '@/lib/admin';
import Invites from '@/components/admin/Invites';

export const dynamic = 'force-dynamic';

export default async function InvitesPage() {
  await requireStaffPage('invites.manage');
  return <Invites />;
}
