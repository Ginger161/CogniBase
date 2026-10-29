import { requireStaffPage } from '@/lib/admin';
import { Audit } from '@/components/admin/Simple';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await requireStaffPage('audit.view');
  return <Audit />;
}
