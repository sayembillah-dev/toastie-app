import { MeetingsTabs } from '@/components/meetings/meetings-tabs';
import { AccessGate } from '@/components/permissions/access-gate';

export default function MeetingsPage() {
  return (
    <AccessGate resource="meeting">
      <MeetingsTabs />
    </AccessGate>
  );
}
