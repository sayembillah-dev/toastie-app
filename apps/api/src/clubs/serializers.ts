import type { Club } from '@prisma/client';

import type { OrgClubStatus } from './dto/clubs.dto';

/** Wire shape for `GET /org-clubs` — string-identical to the web
 * `lib/org/types.ts` `OrgClub` interface. `areaId` is non-null in this
 * projection because we filter unplaced clubs out at the query level. */
export interface OrgClubWire {
  id: string;
  areaId: string;
  name: string;
  clubNumber?: string;
  status: OrgClubStatus;
  createdAt: string;
  updatedAt?: string;
}

/** Minimal projection for the anonymous `GET /clubs/directory` endpoint —
 * the public directory a self-registering user browses before signing up.
 * Includes only what the directory renders; no lineage. */
export interface PublicClubWire {
  id: string;
  slug: string;
  name: string;
  clubNumber?: string;
}

export function toOrgClubWire(row: Club): OrgClubWire {
  if (!row.areaId) {
    // Should not happen for rows returned by the directory list — unplaced
    // clubs are filtered before serialization. Throw here rather than
    // returning a mangled shape.
    throw new Error(`Club ${row.id} has no areaId`);
  }
  const out: OrgClubWire = {
    id: row.id,
    areaId: row.areaId,
    name: row.name,
    status: row.directoryStatus,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.clubNumber) out.clubNumber = row.clubNumber;
  if (row.updatedAt.getTime() !== row.createdAt.getTime()) {
    out.updatedAt = row.updatedAt.toISOString();
  }
  return out;
}

export function toPublicClubWire(
  row: Pick<Club, 'id' | 'slug' | 'name' | 'clubNumber'>,
): PublicClubWire {
  const out: PublicClubWire = { id: row.id, slug: row.slug, name: row.name };
  if (row.clubNumber) out.clubNumber = row.clubNumber;
  return out;
}
