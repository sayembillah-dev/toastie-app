import { AppShell } from '@/components/app-shell';
import { FinanceTabs } from '@/components/finance/finance-tabs';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function FinancePage() {
  return (
    <AppShell>
      <ModuleAccessGate module="finance">
        <FinanceTabs />
      </ModuleAccessGate>
    </AppShell>
  );
}
