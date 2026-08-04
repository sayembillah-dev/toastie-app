import { AppShell } from '@/components/app-shell';
import { InventoryTabs } from '@/components/inventory/inventory-tabs';

export default function InventoryPage() {
  return (
    <AppShell>
      <InventoryTabs />
    </AppShell>
  );
}
