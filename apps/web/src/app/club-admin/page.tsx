import { AppShell } from '@/components/app-shell';
import { ClubAdminTabs } from '@/components/club-admin/club-admin-tabs';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function ClubAdminPage() {
  return (
    <AppShell breadcrumbLabel="Club Admin">
      <ModuleAccessGate module="clubAdmin">
        <ClubAdminTabs />
      </ModuleAccessGate>
    </AppShell>
  );
}
