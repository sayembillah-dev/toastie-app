'use client';

import { AppShell } from '@/components/app-shell';
import { CURRENT_AREA_ID } from '@/lib/org/current-scope';
import { useListAreasQuery } from '@/store/api';

import { ClubsList } from './clubs-list';

/** Area dashboard — the leaf level of the org tree. An area director sees
 * only their own clubs; there is no further drill-down. A club here can be
 * moved to any sibling area in the same division. */
export function AreaScreen() {
  const { data: areas } = useListAreasQuery();
  const area = areas?.find((entry) => entry.id === CURRENT_AREA_ID);
  const siblingAreas = area
    ? (areas ?? []).filter((entry) => entry.divisionId === area.divisionId)
    : [];
  const moveOptions = siblingAreas.map((entry) => ({ value: entry.id, label: entry.name }));

  return (
    <AppShell breadcrumbTrail={[{ href: '/area', title: area?.name ?? 'Area' }]}>
      <ClubsList
        title={area ? `${area.name} — Clubs` : 'Clubs'}
        subtitle="Create, rename or move a club to a different area."
        areaId={CURRENT_AREA_ID}
        canDelete={false}
        moveOptions={moveOptions}
      />
    </AppShell>
  );
}
