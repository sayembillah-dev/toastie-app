import type { WordOfTheDay } from './draft';

export interface PublicAgendaRole {
  roleKey: string;
  name: string;
}

export interface PublicAgendaSpeaker {
  order: number;
  title: string;
  duration: number | null;
  pathway: string | null;
  project: string | null;
  speakerName: string;
  evaluatorName: string;
}

/** Wire shape served by `/public/meetings/:id/agenda` — the published
 * run-of-show, open to anyone with the meeting id (no share token). Every
 * role/speaker slot already carries a resolved display name, so rendering
 * it never needs a roster lookup. */
export interface PublicMeetingAgenda {
  id: string;
  meetingNumber: number;
  dateTime: string;
  theme: string;
  clubName: string;
  clubContactPhone: string | null;
  clubVenueMapUrl: string | null;
  word?: WordOfTheDay;
  roles: PublicAgendaRole[];
  speakers: PublicAgendaSpeaker[];
}
