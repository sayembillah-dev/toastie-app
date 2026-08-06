import { EducationTabs } from '@/components/education/education-tabs';
import { AccessGate } from '@/components/permissions/access-gate';

export default function EducationPage() {
  return (
    <AccessGate resource="education">
      <EducationTabs />
    </AccessGate>
  );
}
