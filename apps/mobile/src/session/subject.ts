/**
 * Turning a session into an authorization subject, and into the list of
 * contexts the user may act within.
 *
 * This mirrors `apps/web/src/lib/permissions/subject.ts` field for field, which
 * in turn mirrors `SubjectFactory.toSubject` in the API. All three build the
 * same `PermissionSubject` from the same `SessionResponse`, so a control this
 * client renders and a request the API answers can never disagree
 * (docs/TDD.md section 7).
 *
 * Note the subject carries *every* assignment, not just the active one — the
 * engine narrows by target, not by subject. Sizing a check to the current club
 * is `useCan`'s job (see `use-can.ts`).
 */

import type { Assignment, PermissionSubject } from '@toastly/access';

import type { Session } from '@/api';
import type { ActiveContext } from './context-value';
import { contextKey } from './context-value';

/** Every membership becomes a `club` assignment, every org assignment an `org`
 * one, and a super admin gets the singleton `global` assignment. */
export function sessionToSubject(session: Session): PermissionSubject {
  const assignments: Assignment[] = [];

  if (session.user.isSuperAdmin) {
    assignments.push({ kind: 'global', role: 'SuperAdmin' });
  }

  for (const membership of session.memberships) {
    assignments.push({
      kind: 'club',
      clubId: membership.clubId,
      membershipId: membership.membershipId,
      roles: membership.roles,
      overrides: membership.overrides,
      lineage: membership.lineage,
    });
  }

  for (const assignment of session.orgAssignments) {
    assignments.push({
      kind: 'org',
      unitType: assignment.unitType,
      unitId: assignment.unitId,
      role: assignment.role,
      lineage: assignment.lineage,
    });
  }

  return { userId: session.user.id, assignments };
}

/** Every context the user may switch into, for the context picker. */
export function availableContexts(session: Session): ActiveContext[] {
  const contexts: ActiveContext[] = session.memberships.map((m) => ({
    kind: 'club' as const,
    clubId: m.clubId,
    membershipId: m.membershipId,
  }));

  for (const assignment of session.orgAssignments) {
    contexts.push({
      kind: 'org',
      unitType: assignment.unitType,
      unitId: assignment.unitId,
    });
  }

  if (session.user.isSuperAdmin) contexts.push({ kind: 'global' });
  return contexts;
}

/**
 * The context to land in when the user has not chosen one, or when their stored
 * choice no longer exists.
 *
 * The server already picked one and sent it as `defaultContextKey`, so this
 * resolves that rather than re-deriving the rule — two independent orderings
 * would eventually disagree about which club a member opens into. The fallback
 * only covers a key naming something no longer in the session.
 */
export function defaultContext(session: Session): ActiveContext | null {
  const contexts = availableContexts(session);
  const preferred = contexts.find((context) => contextKey(context) === session.defaultContextKey);
  // A signed-in user with no membership, no assignment and no admin flag is a
  // real state, reached by registering without joining a club yet. Onboarding
  // handles it (docs/PRD.md section 7, Onboarding); it is not an error.
  return preferred ?? contexts[0] ?? null;
}
