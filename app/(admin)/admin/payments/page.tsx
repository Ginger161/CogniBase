import { requireStaffPage } from '@/lib/admin';
import { Payments } from '@/components/admin/Simple';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  await requireStaffPage('billing.view');
  return <Payments />;
}
