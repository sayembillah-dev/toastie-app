import type { Club } from '@prisma/client';

import type { StorageService } from '@/storage';

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

/** Projection for the anonymous `GET /clubs/directory` endpoint — the public
 * directory a self-registering or clubless user browses. Lineage names are
 * included (not just ids) so a "basic info" card can render "Area 3B,
 * Division C, District 88" without a second round-trip; a self-registered,
 * still-unplaced club simply omits them. */
export interface PublicClubWire {
  id: string;
  slug: string;
  name: string;
  clubNumber?: string;
  areaName?: string;
  divisionName?: string;
  districtName?: string;
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

/** Wire shape for `GET`/`PATCH /clubs/mine` — a Club Admin's own club, with
 * the profile fields they can edit plus the lineage names auto-populated
 * from org placement (read-only; a Director changes these, not the club
 * itself). */
export interface ClubProfileWire {
  id: string;
  name: string;
  clubNumber?: string;
  motto?: string;
  venueAddress?: string;
  venueMapUrl?: string;
  contactPhone?: string;
  socials: { platform: string; url: string }[];
  areaName?: string;
  divisionName?: string;
  districtName?: string;
  bannerColor?: string;
  /** Signed, time-limited URL for the custom agenda banner image — minted
   * per response like `UserWire.avatarUrl`, so it is never sent back. */
  bannerImageUrl?: string;
  bannerImagePos?: { x: number; y: number; zoom: number; aspect?: number };
  updatedAt: string;
}

export async function toClubProfileWire(
  row: Pick<
    Club,
    | 'id'
    | 'name'
    | 'clubNumber'
    | 'motto'
    | 'venueAddress'
    | 'venueMapUrl'
    | 'contactPhone'
    | 'socials'
    | 'bannerColor'
    | 'bannerImage'
    | 'bannerImagePos'
    | 'updatedAt'
  > & {
    area?: { name: string; division?: { name: string; district?: { name: string } } } | null;
  },
  storage: StorageService,
): Promise<ClubProfileWire> {
  const out: ClubProfileWire = {
    id: row.id,
    name: row.name,
    socials: Array.isArray(row.socials) ? (row.socials as { platform: string; url: string }[]) : [],
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.clubNumber) out.clubNumber = row.clubNumber;
  if (row.motto) out.motto = row.motto;
  if (row.venueAddress) out.venueAddress = row.venueAddress;
  if (row.venueMapUrl) out.venueMapUrl = row.venueMapUrl;
  if (row.contactPhone) out.contactPhone = row.contactPhone;
  if (row.bannerColor) out.bannerColor = row.bannerColor;
  const bannerImageUrl = await storage.resolveOptional(row.bannerImage);
  if (bannerImageUrl) out.bannerImageUrl = bannerImageUrl;
  if (
    row.bannerImagePos &&
    typeof row.bannerImagePos === 'object' &&
    !Array.isArray(row.bannerImagePos)
  ) {
    out.bannerImagePos = row.bannerImagePos as ClubProfileWire['bannerImagePos'];
  }
  if (row.area) {
    out.areaName = row.area.name;
    if (row.area.division) {
      out.divisionName = row.area.division.name;
      if (row.area.division.district) out.districtName = row.area.division.district.name;
    }
  }
  return out;
}

export function toPublicClubWire(
  row: Pick<Club, 'id' | 'slug' | 'name' | 'clubNumber'> & {
    area?: { name: string; division?: { name: string; district?: { name: string } } } | null;
  },
): PublicClubWire {
  const out: PublicClubWire = { id: row.id, slug: row.slug, name: row.name };
  if (row.clubNumber) out.clubNumber = row.clubNumber;
  if (row.area) {
    out.areaName = row.area.name;
    if (row.area.division) {
      out.divisionName = row.area.division.name;
      if (row.area.division.district) out.districtName = row.area.division.district.name;
    }
  }
  return out;
}
