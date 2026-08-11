import { ClubProfileTab } from '@/components/club-admin/club-profile-tab';
import { AccessGate } from '@/components/permissions/access-gate';

export default function ClubAdminProfilePage() {
  return (
    <AccessGate resource="club" action="update">
      <ClubProfileTab />
    </AccessGate>
  );
}
