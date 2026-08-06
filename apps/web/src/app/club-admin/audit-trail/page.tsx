import { AppShell } from '@/components/app-shell';
import { AuditTrailTab } from '@/components/club-admin/audit-trail-tab';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function ClubAdminAuditTrailPage() {
  return (
    <AppShell>
      <ModuleAccessGate module="clubAdmin">
        <AuditTrailTab />
      </ModuleAccessGate>
    </AppShell>
  );
}
