import { InventoryTabs } from '@/components/inventory/inventory-tabs';
import { AccessGate } from '@/components/permissions/access-gate';

export default function InventoryPage() {
  return (
    <AccessGate resource="inventory">
      <InventoryTabs />
    </AccessGate>
  );
}
