import { FinanceTabs } from '@/components/finance/finance-tabs';
import { AccessGate } from '@/components/permissions/access-gate';

export default function FinancePage() {
  return (
    <AccessGate resource="transaction">
      <FinanceTabs />
    </AccessGate>
  );
}
