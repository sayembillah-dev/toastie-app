/** Tenant clubs — the operational tenant boundary. Merges what used to be
 * two separate universes: the org-directory `OrgClub` (District > Division >
 * Area > OrgClub) and the implicit single club every operational row lives in.
 * Once the real backend is in, these are the same rows.
 *
 * The three-club seed is deliberate: cross-tenant leakage is only visible if
 * there is more than one tenant. `club-01` is the primary club whose seed data
 * matches everything else in the app; `club-02` and `club-03` are empty
 * shells whose presence lets us verify scoping. */

export const CLUB_DIRECTORY_STATUSES = ['active', 'low', 'suspended'] as const;
export type ClubDirectoryStatus = (typeof CLUB_DIRECTORY_STATUSES)[number];

export const CLUB_LIFECYCLES = ['active', 'inactive', 'chartered'] as const;
export type ClubLifecycle = (typeof CLUB_LIFECYCLES)[number];

export const CLUB_JOIN_POLICIES = ['request', 'closed', 'open'] as const;
export type ClubJoinPolicy = (typeof CLUB_JOIN_POLICIES)[number];

export interface Club {
  id: string;
  areaId?: string;
  /** Denormalised lineage — copies of the parent chain so scope resolution
   * doesn't need a recursive CTE. Reparenting rewrites both fields in the
   * same transaction. */
  divisionId?: string;
  districtId?: string;
  name: string;
  /** URL-safe identifier for the public directory (`/clubs/<slug>`). */
  slug: string;
  clubNumber?: string;
  directoryStatus: ClubDirectoryStatus;
  lifecycle: ClubLifecycle;
  joinPolicy: ClubJoinPolicy;
  createdAt: string;
  updatedAt?: string;
}

/** The club everything in the pre-multi-tenancy app belonged to.
 * Every operational seed row uses this id so the app renders identically
 * to before the tenancy shape landed. */
export const PRIMARY_CLUB_ID = 'club-01';

export const SEED_CLUBS: Club[] = [
  {
    id: PRIMARY_CLUB_ID,
    areaId: 'area-a1',
    divisionId: 'div-a',
    districtId: 'dist-88',
    name: 'Sunrise Toastmasters',
    slug: 'sunrise',
    clubNumber: '1002345',
    directoryStatus: 'active',
    lifecycle: 'active',
    joinPolicy: 'request',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-02',
    areaId: 'area-a1',
    divisionId: 'div-a',
    districtId: 'dist-88',
    name: 'Riverside Speakers',
    slug: 'riverside',
    clubNumber: '1004521',
    directoryStatus: 'active',
    lifecycle: 'active',
    joinPolicy: 'request',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-03',
    areaId: 'area-a1',
    divisionId: 'div-a',
    districtId: 'dist-88',
    name: 'Downtown Voices',
    slug: 'downtown',
    clubNumber: '1009981',
    directoryStatus: 'low',
    lifecycle: 'active',
    joinPolicy: 'request',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
];
