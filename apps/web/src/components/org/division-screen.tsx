'use client';

import { useParams } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { CURRENT_DIVISION_ID } from '@/lib/org/current-scope';
import { useListAreasQuery, useListDivisionsQuery } from '@/store/api';

import { AreasList } from './areas-list';
import { ClubsList } from './clubs-list';

/** Division dashboard root — every area under the officer's division. Areas
 * can be created and renamed but, unlike Super Admin, not moved to a
 * different division or deleted. */
export function DivisionAreasScreen() {
  const { data: divisions } = useListDivisionsQuery();
  const division = divisions?.find((entry) => entry.id === CURRENT_DIVISION_ID);

  return (
    <AppShell breadcrumbTrail={[{ href: '/division', title: division?.name ?? 'Division' }]}>
      <AreasList
        title={division ? `${division.name} — Areas` : 'Areas'}
        subtitle="Create, rename or drill into an area to see its clubs."
        divisionId={CURRENT_DIVISION_ID}
        hrefFor={(area) => `/division/${area.id}`}
        canDelete={false}
        canMove={false}
        moveOptions={[]}
      />
    </AppShell>
  );
}

/** One area's clubs — Division's drill-down level. A club here can be moved
 * to any other area in the division. */
export function DivisionClubsScreen() {
  const params = useParams<{ areaId: string }>();
  const areaId = params?.areaId ?? '';

  const { data: divisions } = useListDivisionsQuery();
  const division = divisions?.find((entry) => entry.id === CURRENT_DIVISION_ID);
  const { data: areas } = useListAreasQuery(CURRENT_DIVISION_ID);
  const area = areas?.find((entry) => entry.id === areaId);

  const moveOptions = (areas ?? []).map((entry) => ({ value: entry.id, label: entry.name }));

  return (
    <AppShell
      breadcrumbTrail={[
        { href: '/division', title: division?.name ?? 'Division' },
        { href: `/division/${areaId}`, title: area?.name ?? 'Area' },
      ]}
    >
      <ClubsList
        title={area ? `${area.name} — Clubs` : 'Clubs'}
        subtitle="Create, rename or move a club to a different area in the division."
        areaId={areaId}
        canDelete={false}
        moveOptions={moveOptions}
      />
    </AppShell>
  );
}
