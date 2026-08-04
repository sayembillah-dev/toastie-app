import { AppShell } from '@/components/app-shell';
import { FinanceTabs } from '@/components/finance/finance-tabs';

export default function FinancePage() {
  return (
    <AppShell>
      <FinanceTabs />
    </AppShell>
  );
}
