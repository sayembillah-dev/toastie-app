'use client';

import { skipToken } from '@reduxjs/toolkit/query';
import { useParams } from 'next/navigation';

import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { CURRENT_DISTRICT_ID } from '@/lib/org/current-scope';
import { areaMoveOptions } from '@/lib/org/move-options';
import { useListAreasQuery, useListDistrictsQuery, useListDivisionsQuery } from '@/store/api';

import { AreasList } from './areas-list';
import { ClubsList } from './clubs-list';
import { DivisionsList } from './divisions-list';

/** District dashboard root — every division under the officer's district.
 * District can create and rename divisions but, unlike Super Admin, can't
 * delete one or move it to a different district. */
export function DistrictDivisionsScreen() {
  const { data: districts } = useListDistrictsQuery();
  const district = districts?.find((entry) => entry.id === CURRENT_DISTRICT_ID);

  return (
    <>
      <PageBreadcrumb trail={[{ href: '/district', title: district?.name ?? 'District' }]} />
      <DivisionsList
        title={district ? `${district.name} — Divisions` : 'Divisions'}
        subtitle="Create, rename or drill into a division to see its areas."
        districtId={CURRENT_DISTRICT_ID}
        hrefFor={(division) => `/district/${division.id}`}
        canDelete={false}
        canMove={false}
        moveOptions={[]}
      />
    </>
  );
}

/** One division's areas — District's first drill-down level. Areas can be
 * created, renamed and moved to any area's club moved across the district,
 * but the areas themselves stay put until Super Admin reparents them. */
export function DistrictAreasScreen() {
  const params = useParams<{ divisionId: string }>();
  const divisionId = params?.divisionId ?? '';

  const { data: districts } = useListDistrictsQuery();
  const district = districts?.find((entry) => entry.id === CURRENT_DISTRICT_ID);
  const { data: divisions } = useListDivisionsQuery(CURRENT_DISTRICT_ID);
  const division = divisions?.find((entry) => entry.id === divisionId);

  return (
    <>
      <PageBreadcrumb
        trail={[
          { href: '/district', title: district?.name ?? 'District' },
          { href: `/district/${divisionId}`, title: division?.name ?? 'Division' },
        ]}
      />
      <AreasList
        title={division ? `${division.name} — Areas` : 'Areas'}
        subtitle="Create, rename or drill into an area to see its clubs."
        divisionId={divisionId}
        hrefFor={(area) => `/district/${divisionId}/${area.id}`}
        canDelete={false}
        canMove={false}
        moveOptions={[]}
      />
    </>
  );
}

/** One area's clubs — District's deepest drill-down level. A club here can
 * be moved to any area anywhere in the district, not just siblings under the
 * same division. */
export function DistrictClubsScreen() {
  const params = useParams<{ divisionId: string; areaId: string }>();
  const divisionId = params?.divisionId ?? '';
  const areaId = params?.areaId ?? '';

  const { data: districts } = useListDistrictsQuery();
  const district = districts?.find((entry) => entry.id === CURRENT_DISTRICT_ID);
  const { data: divisions } = useListDivisionsQuery(CURRENT_DISTRICT_ID);
  const division = divisions?.find((entry) => entry.id === divisionId);
  const { data: areas } = useListAreasQuery(divisionId || skipToken);
  const area = areas?.find((entry) => entry.id === areaId);
  const { data: allAreas } = useListAreasQuery();

  const districtDivisionIds = new Set((divisions ?? []).map((entry) => entry.id));
  const districtAreas = (allAreas ?? []).filter((entry) =>
    districtDivisionIds.has(entry.divisionId),
  );
  const moveOptions = areaMoveOptions(districtAreas, divisions ?? []);

  return (
    <>
      <PageBreadcrumb
        trail={[
          { href: '/district', title: district?.name ?? 'District' },
          { href: `/district/${divisionId}`, title: division?.name ?? 'Division' },
          { href: `/district/${divisionId}/${areaId}`, title: area?.name ?? 'Area' },
        ]}
      />
      <ClubsList
        title={area ? `${area.name} — Clubs` : 'Clubs'}
        subtitle="Create, rename or move a club to a different area in the district."
        areaId={areaId}
        canDelete={false}
        moveOptions={moveOptions}
      />
    </>
  );
}
