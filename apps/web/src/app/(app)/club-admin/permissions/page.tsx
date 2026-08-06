import { PermissionsTab } from '@/components/club-admin/permissions-tab';
import { AccessGate } from '@/components/permissions/access-gate';

export default function ClubAdminPermissionsPage() {
  return (
    <AccessGate resource="memberPermission">
      <PermissionsTab />
    </AccessGate>
  );
}
