import type { Meeting } from '@prisma/client';

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
