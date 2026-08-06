import { MembersTab } from '@/components/club-admin/members-tab';
import { AccessGate } from '@/components/permissions/access-gate';

export default function ClubAdminMembersPage() {
  return (
    <AccessGate resource="memberRole">
      <MembersTab />
    </AccessGate>
  );
}
