import { AppShell } from '@/components/app-shell';
import { EducationTabs } from '@/components/education/education-tabs';
import { ModuleAccessGate } from '@/components/permissions/module-access-gate';

export default function EducationPage() {
  return (
    <AppShell>
      <ModuleAccessGate module="education">
        <EducationTabs />
      </ModuleAccessGate>
    </AppShell>
  );
}
