import type { PreparedSpeakerWire } from './prepared-speakers';
import type { RoleAssignment } from './role-assignments';
import type { RoleDef } from './roles';

/** The one action the dashboard hero offers: whatever the member should do
 * next for this meeting. The lineup card already links to the full agenda,
 * so the hero never does. */
export interface MyNextStep {
  label: string;
  /** Meeting detail tab key — `?tab=` resolves on desktop and mobile alike. */
  tab: string;
}

/** Roles whose holder works from a live tool on the meeting page. */
const TOOL_TABS: Record<string, { tab: string; label: string }> = {
  timer: { tab: 'timer', label: 'Open my Timer' },
  'ah-counter': { tab: 'ah-counter', label: 'Open my Ah Counter' },
  grammarian: { tab: 'grammarian', label: 'Open my Grammarian sheet' },
  'table-topic-master': { tab: 'table-topics', label: 'Open my Table Topics' },
};

/** Role slots first (they carry a live tool), then a speech, then an
 * evaluation; a member holding nothing is invited to take a role. */
export function myNextStep(
  memberId: string,
  roleDefs: RoleDef[],
  roles: RoleAssignment[],
  speakers: PreparedSpeakerWire[],
): MyNextStep {
  const mine = roleDefs.filter((def) =>
    roles.some((row) => row.roleKey === def.key && row.membershipId === memberId),
  );
  const tool = mine.find((def) => TOOL_TABS[def.key]);
  if (tool) return TOOL_TABS[tool.key];
  if (speakers.some((speaker) => speaker.membershipId === memberId)) {
    return { label: 'My speech details', tab: 'prepared-speakers' };
  }
  if (speakers.some((speaker) => speaker.evaluatorMembershipId === memberId)) {
    return { label: 'My evaluation', tab: 'prepared-speakers' };
  }
  if (mine.length > 0) return { label: 'See my role', tab: 'roles' };
  return { label: 'Take a role', tab: 'roles' };
}
