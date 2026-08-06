import { AppShell } from '@/components/app-shell';
import { PermissionsTab } from '@/components/club-admin/permissions-tab';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function ClubAdminPermissionsPage() {
  return (
    <AppShell>
      <ModuleAccessGate module="clubAdmin">
        <PermissionsTab />
      </ModuleAccessGate>
    </AppShell>
  );
}
