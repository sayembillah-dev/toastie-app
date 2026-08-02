import { AppShell } from '@/components/app-shell';
import { MeetingsTabs } from '@/components/meetings/meetings-tabs';

export default function MeetingsPage() {
  return (
    <AppShell>
      <MeetingsTabs />
    </AppShell>
  );
}
