import { PeopleTabs } from '@/components/people/people-tabs';
import { AccessGate } from '@/components/permissions/access-gate';

export default function PeoplePage() {
  return (
    <AccessGate resource="member">
      <PeopleTabs />
    </AccessGate>
  );
}
