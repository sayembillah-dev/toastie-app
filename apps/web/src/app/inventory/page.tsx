import { AppShell } from '@/components/app-shell';
import { InventoryTabs } from '@/components/inventory/inventory-tabs';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function InventoryPage() {
  return (
    <AppShell>
      <ModuleAccessGate module="inventory">
        <InventoryTabs />
      </ModuleAccessGate>
    </AppShell>
  );
}
