import { LibraryTabs } from '@/components/library/library-tabs';
import { AccessGate } from '@/components/permissions/access-gate';

export default function LibraryPage() {
  return (
    <AccessGate resource="library">
      <LibraryTabs />
    </AccessGate>
  );
}
