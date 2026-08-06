import { AppShell } from '@/components/app-shell';
import { MeetingsTabs } from '@/components/meetings/meetings-tabs';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function MeetingsPage() {
  return (
    <AppShell>
      <ModuleAccessGate module="meetings">
        <MeetingsTabs />
      </ModuleAccessGate>
    </AppShell>
  );
}
