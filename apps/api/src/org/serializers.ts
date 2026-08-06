import type { Area, District, Division } from '@prisma/client';

/** Wire shapes for the org tree — string-identical to the web `lib/org/types`
 * `District` / `Division` / `Area` interfaces, so a live-domain flip is a
 * pure transport swap. Kept next to the services because they own the DB
 * projection. */

export interface DistrictWire {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DivisionWire {
  id: string;
  districtId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AreaWire {
  id: string;
  divisionId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export function toDistrictWire(row: District): DistrictWire {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: sameInstant(row.createdAt, row.updatedAt) ? undefined : row.updatedAt.toISOString(),
  };
}

export function toDivisionWire(row: Division): DivisionWire {
  return {
    id: row.id,
    districtId: row.districtId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: sameInstant(row.createdAt, row.updatedAt) ? undefined : row.updatedAt.toISOString(),
  };
}

export function toAreaWire(row: Area): AreaWire {
  return {
    id: row.id,
    divisionId: row.divisionId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: sameInstant(row.createdAt, row.updatedAt) ? undefined : row.updatedAt.toISOString(),
  };
}

/** Prisma stamps `updatedAt` on every row at insert time; the web shape treats
 * that first stamp as "never updated" and omits the field. Same-instant
 * comparison is safe: our writes always advance `updatedAt` past `createdAt`
 * by at least a microsecond. */
function sameInstant(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}
