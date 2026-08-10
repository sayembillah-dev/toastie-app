import { Prisma } from '@prisma/client';

/** Stages a guest can still be nudged out of by a fresh visit. Anyone already
 * past this point (`joined-club`) or parked (`not-interested`) made a
 * decision — a visit shouldn't silently overturn it. */
const ADVANCEABLE_STAGES = new Set(['new', 'contacted', 'interested']);

/** Recomputes `visitCount`/`firstVisit`/`lastVisit` on a `Prospect` from its
 * `VisitLog` rows, and forward-only bumps `stage` to `joined-meetings` once
 * the count goes above zero. Called after every visit-log create/update/
 * delete (manual, from the guest profile, or automatic, from meeting
 * attendance) so the two entry points can never drift apart.
 *
 * A log's "visit date" is its linked meeting's `dateTime` when present,
 * falling back to the log's own `createdAt` — the same fallback
 * `PeopleService.listVisitLogs` already sorts by. */
export async function syncGuestVisitStats(
  tx: Prisma.TransactionClient,
  prospectId: string,
): Promise<void> {
  const logs = await tx.visitLog.findMany({
    where: { prospectId },
    select: { createdAt: true, meeting: { select: { dateTime: true } } },
  });

  const visitCount = logs.length;
  const dates = logs.map((log) => log.meeting?.dateTime ?? log.createdAt);
  const firstVisit = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const lastVisit = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  const existing = await tx.prospect.findUnique({
    where: { id: prospectId },
    select: { stage: true },
  });
  const stage =
    visitCount > 0 && existing && ADVANCEABLE_STAGES.has(existing.stage)
      ? 'joined-meetings'
      : undefined;

  await tx.prospect.update({
    where: { id: prospectId },
    data: { visitCount, firstVisit, lastVisit, ...(stage ? { stage } : {}) },
  });
}
