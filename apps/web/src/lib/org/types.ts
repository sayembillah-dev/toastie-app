/** The organisational tree above a club: District > Division > Area > Club.
 * Distinct from the operational club data everywhere else in `lib/` (meetings,
 * members, finance, …), which is scoped to a single home club — these records
 * are the directory an area/division/district officer manages instead. */

export const ORG_NAME_MAX = 80;
export const DISTRICT_CODE_MAX = 12;
export const CLUB_NUMBER_MAX = 20;

export interface District {
  id: string;
  name: string;
  /** Short designator, e.g. "D88" — Toastmasters districts are commonly
   * referred to by number/code rather than full name. */
  code: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateDistrictInput {
  name: string;
  code: string;
}

export interface UpdateDistrictInput {
  name?: string;
  code?: string;
}

export interface Division {
  id: string;
  districtId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateDivisionInput {
  districtId: string;
  name: string;
}

export interface UpdateDivisionInput {
  name?: string;
  /** Present to reparent the division under a different district. */
  districtId?: string;
}

export interface Area {
  id: string;
  divisionId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAreaInput {
  divisionId: string;
  name: string;
}

export interface UpdateAreaInput {
  name?: string;
  /** Present to reparent the area under a different division. */
  divisionId?: string;
}

export const ORG_CLUB_STATUSES = ['active', 'low', 'suspended'] as const;
export type OrgClubStatus = (typeof ORG_CLUB_STATUSES)[number];

export function isOrgClubStatus(value: unknown): value is OrgClubStatus {
  return typeof value === 'string' && (ORG_CLUB_STATUSES as readonly string[]).includes(value);
}

/** A club as it appears in the org directory — separate from this app's own
 * single-club operational data (meetings, members, finance…), which belongs
 * to exactly one of these rows once a real backend ties the two together. */
export interface OrgClub {
  id: string;
  areaId: string;
  name: string;
  clubNumber?: string;
  status: OrgClubStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateOrgClubInput {
  areaId: string;
  name: string;
  clubNumber?: string;
  status?: OrgClubStatus;
}

export interface UpdateOrgClubInput {
  name?: string;
  /** `null` explicitly clears the club number; `undefined` leaves it alone. */
  clubNumber?: string | null;
  status?: OrgClubStatus;
  /** Present to reparent the club under a different area. */
  areaId?: string;
}

export const ORG_CLUB_STATUS_LABELS: Record<OrgClubStatus, string> = {
  active: 'Active',
  low: 'Low membership',
  suspended: 'Suspended',
};
