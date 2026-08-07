import type { OrgAssignment } from '@prisma/client';
import type { OrgRole, OrgUnitType } from '@toastly/access';

export interface OrgAssignmentWire {
  id: string;
  role: OrgRole;
  unitType: OrgUnitType;
  unitId: string;
  unitName: string;
  createdAt: string;
}

type OrgAssignmentRow = OrgAssignment & {
  area: { name: string } | null;
  division: { name: string } | null;
  district: { name: string } | null;
};

export function toOrgAssignmentWire(row: OrgAssignmentRow): OrgAssignmentWire {
  const unitId = row.areaId ?? row.divisionId ?? row.districtId;
  const unitName = row.area?.name ?? row.division?.name ?? row.district?.name;
  if (!unitId || !unitName) {
    throw new Error(`OrgAssignment "${row.id}" has no resolvable unit — data integrity bug`);
  }
  return {
    id: row.id,
    role: row.role,
    unitType: row.unitType,
    unitId,
    unitName,
    createdAt: row.createdAt.toISOString(),
  };
}
