import { AuditTrailTab } from '@/components/club-admin/audit-trail-tab';
import { AccessGate } from '@/components/permissions/access-gate';

export default function ClubAdminAuditTrailPage() {
  return (
    <AccessGate resource="activityLog">
      <AuditTrailTab />
    </AccessGate>
  );
}
