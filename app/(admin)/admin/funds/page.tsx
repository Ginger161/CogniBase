import { can, requireStaffPage } from '@/lib/admin';
import Funds from '@/components/admin/Funds';

export const dynamic = 'force-dynamic';

export default async function FundsPage() {
  const staff = await requireStaffPage('funds.view');
  return <Funds canEdit={can(staff, 'funds.edit')} />;
}
