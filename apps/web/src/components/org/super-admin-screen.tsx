'use client';

import { UsersThree } from '@phosphor-icons/react/dist/ssr';
import { skipToken } from '@reduxjs/toolkit/query';
import { Button } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { areaMoveOptions, divisionMoveOptions } from '@/lib/org/move-options';
import { useListAreasQuery, useListDistrictsQuery, useListDivisionsQuery } from '@/store/api';

import { AreasList } from './areas-list';
import { ClubsList } from './clubs-list';
import { DistrictsList } from './districts-list';
import { DivisionsList } from './divisions-list';

/** Super Admin dashboard root — every district. Sees and can create, edit,
 * move or delete anything from here down; every other unit-switcher scope
 * only manages its own branch. Super Admin has no sidebar nav (the rail is
 * blank in `global` context — see `unitKeyForContext`), so the platform-wide
 * User directory is surfaced as a header action here instead. */
export function SuperAdminDistrictsScreen() {
  return (
    <>
      <PageBreadcrumb trail={[{ href: '/super-admin', title: 'Super Admin' }]} />
      <div className="mb-3 flex justify-end">
        <Link href="/super-admin/users">
          <Button icon={<UsersThree size={15} weight="bold" />}>Manage users</Button>
        </Link>
      </div>
      <DistrictsList
        title="Districts"
        subtitle="The whole org tree. Drill into a district to manage its divisions."
        hrefFor={(district) => `/super-admin/${district.id}`}
      />
    </>
  );
}

/** One district's divisions. Unlike the District dashboard, Super Admin can
 * also delete a division here or move it under a different district. */
export function SuperAdminDivisionsScreen() {
  const params = useParams<{ districtId: string }>();
  const districtId = params?.districtId ?? '';

  const { data: districts } = useListDistrictsQuery();
  const district = districts?.find((entry) => entry.id === districtId);
  const moveOptions = (districts ?? []).map((entry) => ({ value: entry.id, label: entry.name }));

  return (
    <>
      <PageBreadcrumb
        trail={[
          { href: '/super-admin', title: 'Super Admin' },
          { href: `/super-admin/${districtId}`, title: district?.name ?? 'District' },
        ]}
      />
      <DivisionsList
        title={district ? `${district.name} — Divisions` : 'Divisions'}
        subtitle="Create, rename, move or delete a division."
        districtId={districtId}
        hrefFor={(division) => `/super-admin/${districtId}/${division.id}`}
        canDelete
        canMove
        moveOptions={moveOptions}
      />
    </>
  );
}

/** One division's areas. Areas can be moved to any division anywhere, not
 * just within the same district. */
export function SuperAdminAreasScreen() {
  const params = useParams<{ districtId: string; divisionId: string }>();
  const districtId = params?.districtId ?? '';
  const divisionId = params?.divisionId ?? '';

  const { data: districts } = useListDistrictsQuery();
  const district = districts?.find((entry) => entry.id === districtId);
  const { data: allDivisions } = useListDivisionsQuery();
  const division = allDivisions?.find((entry) => entry.id === divisionId);
  const moveOptions = divisionMoveOptions(allDivisions ?? [], districts ?? []);

  return (
    <>
      <PageBreadcrumb
        trail={[
          { href: '/super-admin', title: 'Super Admin' },
          { href: `/super-admin/${districtId}`, title: district?.name ?? 'District' },
          { href: `/super-admin/${districtId}/${divisionId}`, title: division?.name ?? 'Division' },
        ]}
      />
      <AreasList
        title={division ? `${division.name} — Areas` : 'Areas'}
        subtitle="Create, rename, move or delete an area."
        divisionId={divisionId}
        hrefFor={(area) => `/super-admin/${districtId}/${divisionId}/${area.id}`}
        canDelete
        canMove
        moveOptions={moveOptions}
      />
    </>
  );
}

/** One area's clubs — Super Admin's deepest level. Clubs can be moved to any
 * area anywhere in the tree. */
export function SuperAdminClubsScreen() {
  const params = useParams<{ districtId: string; divisionId: string; areaId: string }>();
  const districtId = params?.districtId ?? '';
  const divisionId = params?.divisionId ?? '';
  const areaId = params?.areaId ?? '';

  const { data: districts } = useListDistrictsQuery();
  const district = districts?.find((entry) => entry.id === districtId);
  const { data: allDivisions } = useListDivisionsQuery();
  const division = allDivisions?.find((entry) => entry.id === divisionId);
  const { data: areas } = useListAreasQuery(divisionId || skipToken);
  const area = areas?.find((entry) => entry.id === areaId);
  const { data: allAreas } = useListAreasQuery();
  const moveOptions = areaMoveOptions(allAreas ?? [], allDivisions ?? []);

  return (
    <>
      <PageBreadcrumb
        trail={[
          { href: '/super-admin', title: 'Super Admin' },
          { href: `/super-admin/${districtId}`, title: district?.name ?? 'District' },
          { href: `/super-admin/${districtId}/${divisionId}`, title: division?.name ?? 'Division' },
          {
            href: `/super-admin/${districtId}/${divisionId}/${areaId}`,
            title: area?.name ?? 'Area',
          },
        ]}
      />
      <ClubsList
        title={area ? `${area.name} — Clubs` : 'Clubs'}
        subtitle="Create, rename, move or delete a club."
        areaId={areaId}
        canDelete
        moveOptions={moveOptions}
      />
    </>
  );
}
