import { requireStaffPage } from '@/lib/admin';
import { KillSwitches } from '@/components/admin/Simple';

export const dynamic = 'force-dynamic';

export default async function SwitchesPage() {
  await requireStaffPage('settings.manage');
  return <KillSwitches />;
}
