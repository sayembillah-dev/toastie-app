export const CLUB_ROLES = [
  'Guest',
  'Member',
  'SergeantAtArms',
  'President',
  'Treasurer',
  'VPMembership',
  'VPPR',
  'VPEducation',
  'IPP',
  'Secretary',
  'ClubAdmin',
] as const;

export type ClubRole = (typeof CLUB_ROLES)[number];

export const ORG_ROLES = ['AreaDirector', 'DivisionDirector', 'DistrictDirector'] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_UNIT_TYPES = ['area', 'division', 'district'] as const;
export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export function isClubRole(value: string): value is ClubRole {
  return (CLUB_ROLES as readonly string[]).includes(value);
}

export function isOrgRole(value: string): value is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value);
}
