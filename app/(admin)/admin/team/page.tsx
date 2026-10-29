import { requireStaffPage } from '@/lib/admin';
import Team from '@/components/admin/Team';

export const dynamic = 'force-dynamic';

// Owner only: a moderator who opens this is sent back to their own admin home.
export default async function TeamPage() {
  await requireStaffPage('owner');
  return <Team />;
}
