import type {
  Meeting,
  MeetingAttendance as MeetingAttendanceRow,
  MeetingGuestAttendance as MeetingGuestAttendanceRow,
  MeetingRoleAssignment as MeetingRoleAssignmentRow,
  TableTopicQuestion as TableTopicQuestionRow,
} from '@prisma/client';

/** Wire shape for `/meetings` — string-identical to the web
 * `lib/meetings/meetings.ts` `Meeting` interface. The DB stores
 * `dateTime` as a full timestamp; the frontend expects an ISO string. */
export interface WordOfTheDayWire {
  word: string;
  partOfSpeech?: string;
  meaning: string;
  example: string;
}

export interface MeetingWire {
  id: string;
  clubId: string;
  meetingNumber: number;
  dateTime: string;
  theme: string;
  status: 'draft' | 'published';
  shareToken: string;
  /** Absent until the Theme tab has been filled in — the four columns are
   * null on a fresh meeting, and the client treats a missing `word` as an
   * empty form rather than having to null-check each part. */
  word?: WordOfTheDayWire;
}

export function toMeetingWire(row: Meeting): MeetingWire {
  const wire: MeetingWire = {
    id: row.id,
    clubId: row.clubId,
    meetingNumber: row.meetingNumber,
    dateTime: row.dateTime.toISOString(),
    theme: row.theme,
    status: row.status,
    shareToken: row.shareToken,
  };
  /* The word itself is what makes the block worth sending — a meaning or
   * example with no word to attach it to is not renderable. */
  if (row.word) {
    wire.word = {
      word: row.word,
      meaning: row.wordMeaning ?? '',
      example: row.wordExample ?? '',
    };
    if (row.wordPartOfSpeech) wire.word.partOfSpeech = row.wordPartOfSpeech;
  }
  return wire;
}

/** Wire shape matches the web `lib/meetings/role-assignments.ts`
 * `RoleAssignment` interface. Meeting id is implicit in the URL. */
export interface MeetingRoleAssignmentWire {
  roleKey: string;
  membershipId: string | null;
}

export function toMeetingRoleAssignmentWire(
  row: MeetingRoleAssignmentRow,
): MeetingRoleAssignmentWire {
  return { roleKey: row.roleKey, membershipId: row.membershipId };
}

/** Wire shape matches the web `lib/meetings/table-topics.ts`
 * `TableTopicQuestion` interface. */
export interface TableTopicQuestionWire {
  id: string;
  text: string;
  asked: boolean;
}

export function toTableTopicQuestionWire(row: TableTopicQuestionRow): TableTopicQuestionWire {
  return { id: row.id, text: row.text, asked: row.asked };
}

/** Wire shape matches the web `lib/meetings/attendance.ts` `MemberAttendance`
 * interface. */
export interface MeetingAttendanceWire {
  membershipId: string;
  present: boolean;
}

export function toMeetingAttendanceWire(row: MeetingAttendanceRow): MeetingAttendanceWire {
  return { membershipId: row.membershipId, present: row.present };
}

/** Wire shape matches the web `lib/meetings/attendance.ts` `GuestAttendance`
 * interface. */
export interface MeetingGuestAttendanceWire {
  id: string;
  name: string;
  present: boolean;
}

export function toMeetingGuestAttendanceWire(
  row: MeetingGuestAttendanceRow,
): MeetingGuestAttendanceWire {
  return { id: row.id, name: row.name, present: row.present };
}
