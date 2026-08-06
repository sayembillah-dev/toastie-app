import type { Meeting } from '@prisma/client';

/** Wire shape for `/meetings` — string-identical to the web
 * `lib/meetings/meetings.ts` `Meeting` interface. The DB stores
 * `dateTime` as a full timestamp; the frontend expects an ISO string. */
export interface MeetingWire {
  id: string;
  clubId: string;
  meetingNumber: number;
  dateTime: string;
  theme: string;
  status: 'draft' | 'published';
  shareToken: string;
}

export function toMeetingWire(row: Meeting): MeetingWire {
  return {
    id: row.id,
    clubId: row.clubId,
    meetingNumber: row.meetingNumber,
    dateTime: row.dateTime.toISOString(),
    theme: row.theme,
    status: row.status,
    shareToken: row.shareToken,
  };
}
