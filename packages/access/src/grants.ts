import type { Action, ResourceKey, Scope } from './resources';
import type { ClubRole, OrgRole } from './roles';

export interface Grant {
  resource: ResourceKey;
  action: Action;
  scope: Scope;
}

const rw = (resource: ResourceKey, scope: Scope = 'club'): Grant[] => [
  { resource, action: 'create', scope },
  { resource, action: 'read', scope },
  { resource, action: 'update', scope },
  { resource, action: 'delete', scope },
];

const r = (resource: ResourceKey, scope: Scope = 'club'): Grant[] => [
  { resource, action: 'read', scope },
];

const rmu = (resource: ResourceKey, scope: Scope = 'club'): Grant[] => [
  { resource, action: 'read', scope },
  { resource, action: 'update', scope },
];

const cr = (resource: ResourceKey, scope: Scope = 'club'): Grant[] => [
  { resource, action: 'create', scope },
  { resource, action: 'read', scope },
];

/** Mirrors `MODULES_HIDDEN_BY_DEFAULT` in the legacy `lib/permissions/permissions.ts`:
 * every module there defaults to `read: true` for every role except `clubAdmin` —
 * so every resource it gates gets a baseline club-scoped read here too. Only
 * `memberRole`/`memberPermission` (the `clubAdmin` roster-management surface)
 * are deliberately left out. */
const CLUB_BASE_READ: Grant[] = [
  { resource: 'club', action: 'read', scope: 'club' },
  { resource: 'meeting', action: 'read', scope: 'club' },
  { resource: 'meetingRole', action: 'read', scope: 'club' },
  { resource: 'member', action: 'read', scope: 'club' },
  { resource: 'library', action: 'read', scope: 'club' },
  { resource: 'guest', action: 'read', scope: 'club' },
  { resource: 'guestLog', action: 'read', scope: 'club' },
  { resource: 'education', action: 'read', scope: 'club' },
  { resource: 'checklist', action: 'read', scope: 'club' },
  { resource: 'tableTopic', action: 'read', scope: 'club' },
  { resource: 'attendance', action: 'read', scope: 'club' },
  { resource: 'inventory', action: 'read', scope: 'club' },
  { resource: 'transaction', action: 'read', scope: 'club' },
  { resource: 'budget', action: 'read', scope: 'club' },
  { resource: 'dues', action: 'read', scope: 'club' },
  { resource: 'activityLog', action: 'read', scope: 'club' },
];

const OWN_TASK_ACCESS: Grant[] = [
  { resource: 'task', action: 'read', scope: 'own' },
  { resource: 'task', action: 'update', scope: 'own' },
  { resource: 'evaluation', action: 'read', scope: 'own' },
  { resource: 'speechRequest', action: 'read', scope: 'own' },
  { resource: 'speechRequest', action: 'create', scope: 'own' },
];

const GUEST_ROLE: Grant[] = [{ resource: 'club', action: 'read', scope: 'club' }];

const MEMBER_ROLE: Grant[] = [...CLUB_BASE_READ, ...OWN_TASK_ACCESS];

const SERGEANT_AT_ARMS_ROLE: Grant[] = [
  ...MEMBER_ROLE,
  ...rw('checklist'),
  ...rw('inventory'),
  ...rw('attendance'),
];

const PRESIDENT_ROLE: Grant[] = [
  ...MEMBER_ROLE,
  ...rw('meeting'),
  ...rw('meetingRole'),
  ...rw('tableTopic'),
  ...rw('attendance'),
  ...rmu('education'),
  ...r('activityLog'),
  ...r('report'),
];

const TREASURER_ROLE: Grant[] = [
  ...MEMBER_ROLE,
  ...rw('transaction'),
  ...rw('budget'),
  ...rw('dues'),
];

const VP_MEMBERSHIP_ROLE: Grant[] = [
  ...MEMBER_ROLE,
  ...rw('guest'),
  ...rw('guestLog'),
  ...cr('invite'),
];

const VP_PR_ROLE: Grant[] = [...MEMBER_ROLE, ...rw('library')];

const VP_EDUCATION_ROLE: Grant[] = [
  ...MEMBER_ROLE,
  ...rw('education'),
  ...rw('meeting'),
  ...rw('meetingRole'),
  ...rw('tableTopic'),
  ...rw('speechRequest'),
  ...rw('evaluation'),
  ...rw('task'),
];

const IPP_ROLE: Grant[] = [...MEMBER_ROLE, ...r('report'), ...r('activityLog')];

const SECRETARY_ROLE: Grant[] = [
  ...MEMBER_ROLE,
  ...rw('meeting'),
  ...rw('meetingRole'),
  ...rw('attendance'),
];

const CLUB_ADMIN_ROLE: Grant[] = [
  ...rw('club'),
  ...rw('member'),
  ...rw('memberRole'),
  ...rw('memberPermission'),
  ...rw('meeting'),
  ...rw('meetingRole'),
  ...rw('checklist'),
  ...rw('tableTopic'),
  ...rw('attendance'),
  ...rw('education'),
  ...rw('guest'),
  ...rw('guestLog'),
  ...rw('library'),
  ...rw('inventory'),
  ...rw('transaction'),
  ...rw('budget'),
  ...rw('dues'),
  ...rw('evaluation'),
  ...rw('speechRequest'),
  ...rw('task'),
  ...rw('invite'),
  ...rw('joinRequest'),
  ...r('activityLog'),
  ...r('report'),
];

export const CLUB_ROLE_GRANTS: Record<ClubRole, Grant[]> = {
  Guest: GUEST_ROLE,
  Member: MEMBER_ROLE,
  SergeantAtArms: SERGEANT_AT_ARMS_ROLE,
  President: PRESIDENT_ROLE,
  Treasurer: TREASURER_ROLE,
  VPMembership: VP_MEMBERSHIP_ROLE,
  VPPR: VP_PR_ROLE,
  VPEducation: VP_EDUCATION_ROLE,
  IPP: IPP_ROLE,
  Secretary: SECRETARY_ROLE,
  ClubAdmin: CLUB_ADMIN_ROLE,
};

/** Every resource a Director can see when drilling into one of their clubs.
 * Read-only across the board — Directors observe, they don't mutate club
 * data. Mutations on the org tree itself (`orgUnit:update`, `club:update`)
 * are granted separately by role. Kept in one list so a new resource can't
 * accidentally regress the drill-in surface. */
const DIRECTOR_READ_RESOURCES: ResourceKey[] = [
  'club',
  'member',
  'meeting',
  'meetingRole',
  'checklist',
  'tableTopic',
  'attendance',
  'guest',
  'guestLog',
  'library',
  'inventory',
  'transaction',
  'budget',
  'dues',
  'education',
  'evaluation',
  'speechRequest',
  'task',
  'activityLog',
  'report',
];

const directorReads = (scope: Scope): Grant[] =>
  DIRECTOR_READ_RESOURCES.map((resource) => ({ resource, action: 'read' as Action, scope }));

const AREA_DIRECTOR_GRANTS: Grant[] = [
  { resource: 'orgUnit', action: 'read', scope: 'area' },
  { resource: 'orgUnit', action: 'update', scope: 'area' },
  { resource: 'club', action: 'update', scope: 'area' },
  ...directorReads('area'),
];

const DIVISION_DIRECTOR_GRANTS: Grant[] = [
  { resource: 'orgUnit', action: 'read', scope: 'division' },
  { resource: 'orgUnit', action: 'update', scope: 'division' },
  { resource: 'club', action: 'update', scope: 'division' },
  ...directorReads('division'),
];

const DISTRICT_DIRECTOR_GRANTS: Grant[] = [
  { resource: 'orgUnit', action: 'read', scope: 'district' },
  { resource: 'orgUnit', action: 'update', scope: 'district' },
  { resource: 'club', action: 'update', scope: 'district' },
  ...directorReads('district'),
];

export const ORG_ROLE_GRANTS: Record<OrgRole, Grant[]> = {
  AreaDirector: AREA_DIRECTOR_GRANTS,
  DivisionDirector: DIVISION_DIRECTOR_GRANTS,
  DistrictDirector: DISTRICT_DIRECTOR_GRANTS,
};
