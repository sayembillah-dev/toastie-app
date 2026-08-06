import { AppShell } from '@/components/app-shell';
import { PeopleTabs } from '@/components/people/people-tabs';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function PeoplePage() {
  return (
    <AppShell>
      <ModuleAccessGate module="people">
        <PeopleTabs />
      </ModuleAccessGate>
    </AppShell>
  );
}
