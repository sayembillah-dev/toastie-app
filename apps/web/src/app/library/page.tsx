import { AppShell } from '@/components/app-shell';
import { LibraryTabs } from '@/components/library/library-tabs';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function LibraryPage() {
  return (
    <AppShell>
      <ModuleAccessGate module="library">
        <LibraryTabs />
      </ModuleAccessGate>
    </AppShell>
  );
}
