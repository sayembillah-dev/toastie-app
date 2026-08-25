import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Keeps a linked `PlannerRow` and `Meeting` in sync once "Create meeting" has
 * joined them (`PlannerRow.meetingId`). Edits on either side propagate to the
 * other so the planner grid and the meeting's own tabs never quietly diverge.
 *
 * `ROLE_BY_FIELD`/the speaker pairs mirror the web's
 * `lib/meetings/from-planner.ts` — presentation-owned lists duplicated here
 * because the API and the web app don't share a package for them. Keep the
 * two in sync by hand if a planner column or role key ever changes.
 */

const ROLE_BY_FIELD: Array<[string, string]> = [
  ['tmod', 'toastmaster'],
  ['ttm', 'table-topic-master'],
  ['ttEvaluator', 'table-topic-evaluator'],
  ['generalEvaluator', 'general-evaluator'],
  ['timer', 'timer'],
  ['ahCounter', 'ah-counter'],
  ['grammarian', 'grammarian'],
];

/** [order, speaker field, evaluator field]. */
const SPEAKER_PAIRS: Array<[number, string, string]> = [
  [1, 'speaker1', 'evaluator1'],
  [2, 'speaker2', 'evaluator2'],
  [3, 'speaker3', 'evaluator3'],
  [4, 'speaker4', 'evaluator4'],
];

interface PersonAssignee {
  kind: 'member' | 'guest';
  memberId?: string;
  name?: string;
  guestId?: string;
}

function parseAssignee(value: unknown): PersonAssignee | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.kind === 'member' && typeof v.memberId === 'string') {
    return { kind: 'member', memberId: v.memberId };
  }
  if (v.kind === 'guest' && typeof v.name === 'string') {
    return {
      kind: 'guest',
      name: v.name,
      guestId: typeof v.guestId === 'string' ? v.guestId : undefined,
    };
  }
  return null;
}

interface ResolvedRef {
  membershipId: string | null;
  guestId: string | null;
}

/** `undefined` means "can't resolve, leave whatever's on the meeting alone"
 * — a typed guest with no roster entry has no id to link a foreign key to.
 * Anything else (including an explicit `{null, null}` clear) is a real,
 * apply-it instruction. */
function resolveRef(value: unknown): ResolvedRef | undefined {
  const assignee = parseAssignee(value);
  if (!assignee) return { membershipId: null, guestId: null };
  if (assignee.kind === 'member') return { membershipId: assignee.memberId ?? null, guestId: null };
  if (assignee.guestId) return { membershipId: null, guestId: assignee.guestId };
  return undefined;
}

async function toAssigneeJson(
  tx: Prisma.TransactionClient,
  clubId: string,
  membershipId: string | null,
  guestId: string | null,
): Promise<PersonAssignee | null> {
  if (membershipId) return { kind: 'member', memberId: membershipId };
  if (guestId) {
    const guest = await tx.prospect.findUnique({
      where: { clubId_id: { clubId, id: guestId } },
      select: { firstName: true, lastName: true },
    });
    if (!guest) return null;
    return {
      kind: 'guest',
      name: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
      guestId,
    };
  }
  return null;
}

/** `PlannerRow.dateTime` is a string column holding the same **instant** the
 * meeting's `DateTime` column does — a full ISO-8601 timestamp, offset and
 * all. It deliberately is not truncated to "YYYY-MM-DDTHH:mm": a wall clock
 * with no offset can only be resolved against *some* timezone, and the one
 * this process runs in (UTC on the VPS) is never the one the meeting was
 * scheduled in. Both sides staying instants means this mirror never has to
 * guess. */
function toPlannerDateTime(date: Date): string {
  return date.toISOString();
}

/** Meeting role assignments changed → refresh the linked planner row's
 * seven role columns (Speaker/Evaluator pairs are handled separately). */
export async function syncPlannerRolesFromMeeting(
  tx: Prisma.TransactionClient,
  clubId: string,
  meetingId: string,
): Promise<void> {
  const row = await tx.plannerRow.findFirst({
    where: { clubId, meetingId },
    select: { id: true, assignees: true },
  });
  if (!row) return;

  const assignments = await tx.meetingRoleAssignment.findMany({ where: { clubId, meetingId } });
  const byRoleKey = new Map(assignments.map((a) => [a.roleKey, a]));

  const assignees = { ...((row.assignees as Record<string, unknown>) ?? {}) };
  for (const [field, roleKey] of ROLE_BY_FIELD) {
    const assignment = byRoleKey.get(roleKey);
    assignees[field] = assignment
      ? await toAssigneeJson(tx, clubId, assignment.membershipId, assignment.guestId)
      : null;
  }

  await tx.plannerRow.update({
    where: { id: row.id },
    data: { assignees: assignees as Prisma.InputJsonValue, updatedAt: new Date() },
  });
}

/** Prepared speakers changed → refresh the linked planner row's eight
 * speaker/evaluator columns. */
export async function syncPlannerSpeakersFromMeeting(
  tx: Prisma.TransactionClient,
  clubId: string,
  meetingId: string,
): Promise<void> {
  const row = await tx.plannerRow.findFirst({
    where: { clubId, meetingId },
    select: { id: true, assignees: true },
  });
  if (!row) return;

  const speakers = await tx.meetingSpeaker.findMany({ where: { clubId, meetingId } });
  const byOrder = new Map(speakers.map((s) => [s.order, s]));

  const assignees = { ...((row.assignees as Record<string, unknown>) ?? {}) };
  for (const [order, speakerField, evaluatorField] of SPEAKER_PAIRS) {
    const speaker = byOrder.get(order);
    assignees[speakerField] = speaker
      ? await toAssigneeJson(tx, clubId, speaker.membershipId, speaker.guestId)
      : null;
    assignees[evaluatorField] = speaker
      ? await toAssigneeJson(tx, clubId, speaker.evaluatorMembershipId, speaker.evaluatorGuestId)
      : null;
  }

  await tx.plannerRow.update({
    where: { id: row.id },
    data: { assignees: assignees as Prisma.InputJsonValue, updatedAt: new Date() },
  });
}

/** The meeting's own number/date/theme changed → carry them onto the linked
 * planner row. Only the fields actually passed are touched. */
export async function syncPlannerFieldsFromMeeting(
  tx: Prisma.TransactionClient,
  clubId: string,
  meetingId: string,
  fields: { meetingNumber?: number; dateTime?: Date; theme?: string },
): Promise<void> {
  const row = await tx.plannerRow.findFirst({ where: { clubId, meetingId }, select: { id: true } });
  if (!row) return;

  const data: Prisma.PlannerRowUncheckedUpdateInput = {};
  if (fields.meetingNumber !== undefined) data.meetingNumber = fields.meetingNumber;
  if (fields.dateTime !== undefined) data.dateTime = toPlannerDateTime(fields.dateTime);
  if (fields.theme !== undefined) data.theme = fields.theme;
  if (Object.keys(data).length === 0) return;

  data.updatedAt = new Date();
  await tx.plannerRow.update({ where: { id: row.id }, data });
}

/** A planner row (already linked to a meeting) changed → carry its
 * number/date/theme and its 15 assignee slots onto the meeting side: the 7
 * role columns become `MeetingRoleAssignment` rows, the 4 speaker/evaluator
 * pairs become `MeetingSpeaker` identity fields. Only real, linkable people
 * (members or roster guests) move across — a typed-not-in-roster guest has
 * no id to point a foreign key at and is left for the meeting side to hold
 * as-is, same limitation `buildMeetingSeed` already documents for creation. */
export async function syncMeetingFromPlannerRow(
  tx: Prisma.TransactionClient,
  clubId: string,
  row: {
    meetingId: string | null;
    meetingNumber: number | null;
    dateTime: string | null;
    theme?: string;
    assignees: unknown;
  },
): Promise<void> {
  if (!row.meetingId) return;
  const meeting = await tx.meeting.findUnique({
    where: { id: row.meetingId },
    select: { id: true, clubId: true },
  });
  if (!meeting || meeting.clubId !== clubId) return;

  const meetingData: Prisma.MeetingUpdateInput = {};
  if (row.theme !== undefined) meetingData.theme = row.theme;
  if (row.meetingNumber !== null) meetingData.meetingNumber = row.meetingNumber;
  if (row.dateTime) meetingData.dateTime = new Date(row.dateTime);

  if (Object.keys(meetingData).length > 0) {
    try {
      await tx.meeting.update({ where: { id: meeting.id }, data: meetingData });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'MEETING_NUMBER_TAKEN',
          message: `Meeting ${row.meetingNumber} already exists in this club`,
        });
      }
      throw err;
    }
  }

  const assignees = (row.assignees ?? {}) as Record<string, unknown>;

  for (const [field, roleKey] of ROLE_BY_FIELD) {
    const ref = resolveRef(assignees[field]);
    if (ref === undefined) continue;
    await tx.meetingRoleAssignment.upsert({
      where: { clubId_meetingId_roleKey: { clubId, meetingId: meeting.id, roleKey } },
      create: {
        clubId,
        meetingId: meeting.id,
        roleKey,
        membershipId: ref.membershipId,
        guestId: ref.guestId,
      },
      update: { membershipId: ref.membershipId, guestId: ref.guestId },
    });
  }

  for (const [order, speakerField, evaluatorField] of SPEAKER_PAIRS) {
    const speakerRef = resolveRef(assignees[speakerField]);
    const evaluatorRef = resolveRef(assignees[evaluatorField]);
    const existing = await tx.meetingSpeaker.findUnique({
      where: { clubId_meetingId_order: { clubId, meetingId: meeting.id, order } },
    });

    if (!existing) {
      /* Only a real speaker books the slot — an evaluator alone never spawns
       * a card, matching `buildMeetingSeed`. */
      if (speakerRef && (speakerRef.membershipId || speakerRef.guestId)) {
        await tx.meetingSpeaker.create({
          data: {
            clubId,
            meetingId: meeting.id,
            order,
            membershipId: speakerRef.membershipId,
            guestId: speakerRef.guestId,
            evaluatorMembershipId: evaluatorRef?.membershipId ?? null,
            evaluatorGuestId: evaluatorRef?.guestId ?? null,
          },
        });
      }
      continue;
    }

    const data: Prisma.MeetingSpeakerUncheckedUpdateInput = {};
    if (speakerRef !== undefined) {
      data.membershipId = speakerRef.membershipId;
      data.guestId = speakerRef.guestId;
    }
    if (evaluatorRef !== undefined) {
      data.evaluatorMembershipId = evaluatorRef.membershipId;
      data.evaluatorGuestId = evaluatorRef.guestId;
    }
    if (Object.keys(data).length > 0) {
      await tx.meetingSpeaker.update({ where: { id: existing.id }, data });
    }
  }
}
