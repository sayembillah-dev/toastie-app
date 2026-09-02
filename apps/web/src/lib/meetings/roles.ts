import type { Meeting } from './meetings';

/** Toastmasters convention: meetings at or after 5 PM are Evening events, and
 * everything earlier reads as "of the Day". A single cutoff keeps the label
 * decision testable without a config knob. */
export function isEveningMeeting(dateTime: string): boolean {
  return new Date(dateTime).getHours() >= 17;
}

export function getToastmasterLabel(dateTime: string): string {
  return isEveningMeeting(dateTime) ? 'Toast Master of the Evening' : 'Toast Master of the Day';
}

/** Short form used all over the agenda's run-of-show ("TMOE introduces …"). */
export function getToastmasterAbbrev(dateTime: string): string {
  return isEveningMeeting(dateTime) ? 'TMOE' : 'TMOD';
}

export interface RoleDef {
  key: string;
  label: string;
  /** Optional roles never block readiness: an unassigned optional role isn't
   * counted as a gap and is left off the printed/public agenda entirely. */
  optional?: boolean;
  /** What the role actually does, shown behind the info (ⓘ) button next to
   * the role's label on the Roles tab. */
  description?: string;
}

/** Role keys are the contract between the Roles tab and the agenda — both read
 * from this list, so a renamed label can never desync the two. */
export function buildRoles(meeting: Meeting): RoleDef[] {
  return [
    { key: 'president', label: 'President' },
    { key: 'sergeant-at-arms', label: 'Sergeant at Arms' },
    { key: 'toastmaster', label: getToastmasterLabel(meeting.dateTime) },
    { key: 'general-evaluator', label: 'General Evaluator' },
    { key: 'table-topic-master', label: 'Table Topic Master' },
    { key: 'table-topic-evaluator', label: 'Table Topic Evaluator' },
    { key: 'ah-counter', label: 'Ah Counter' },
    { key: 'timer', label: 'Timer' },
    { key: 'grammarian', label: 'Grammarian' },
    {
      key: 'harkmaster',
      label: 'Harkmaster',
      optional: true,
      description:
        'The Harkmaster listens carefully to the whole meeting and writes questions as it goes. At the end of the meeting they ask those questions to the audience — to find out who was listening most attentively.',
    },
  ];
}

/** Total roles a meeting can assign, optional ones included. */
export const ROLE_COUNT = 10;
