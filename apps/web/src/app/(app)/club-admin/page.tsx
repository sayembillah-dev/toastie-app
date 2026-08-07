import { OverviewTab } from '@/components/club-admin/overview-tab';
import { AccessGate } from '@/components/permissions/access-gate';

export default function ClubAdminPage() {
  return (
    <AccessGate resource="memberRole">
      <OverviewTab />
    </AccessGate>
  );
}
