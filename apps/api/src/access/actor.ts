import type { RequestContext } from './context.guard';

/** The `Membership.id` the caller is acting under in the given club. Every
 * `ActivityLog` row records who did what — we resolve that from the session
 * so services don't have to re-query it after every write.
 *
 * Returns `null` when the caller has no membership in the club (Super
 * Admin acting from `global`, a director drill-in from S13, or any org
 * context). The activity log column is nullable to accept these cases —
 * the row still records the mutation, just without an actor pointer. */
export function actorMembershipIdFor(ctx: RequestContext, clubId: string): string | null {
  const membership = ctx.session.memberships.find((m) => m.clubId === clubId);
  return membership?.membershipId ?? null;
}
