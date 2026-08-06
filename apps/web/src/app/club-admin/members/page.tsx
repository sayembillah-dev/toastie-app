import { AppShell } from '@/components/app-shell';
import { MembersTab } from '@/components/club-admin/members-tab';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function ClubAdminMembersPage() {
  return (
    <AppShell>
      <ModuleAccessGate module="clubAdmin">
        <MembersTab />
      </ModuleAccessGate>
    </AppShell>
  );
}
