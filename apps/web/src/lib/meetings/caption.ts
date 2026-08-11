import type { Meeting } from './meetings';
import { getToastmasterLabel } from './roles';

const CAPTION_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const CAPTION_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Display names for the three roles the invite caption calls out — empty
 * string reads as unassigned and drops that line from the caption. */
export interface CaptionRoleNames {
  generalEvaluator: string;
  tableTopicsMaster: string;
  toastmaster: string;
}

/** Club details the invite caption draws on. Venue/map are blank until the
 * club profile carries them — either drops its line rather than printing
 * an empty stub. */
export interface CaptionClubInfo {
  name: string;
  venueAddress: string;
  venueMapUrl: string;
}

/** Builds the WhatsApp/Facebook invite caption shared for a meeting. Each
 * paragraph is assembled as its own group of lines and the groups are joined
 * with a blank line between them, so the copied text reads as distinct
 * paragraphs instead of one dense block. */
export function buildMeetingCaption(
  meeting: Meeting,
  club: CaptionClubInfo,
  roleNames: CaptionRoleNames,
): string {
  const when = new Date(meeting.dateTime);
  const toastmasterLabel = getToastmasterLabel(meeting.dateTime).replace(
    'Toast Master',
    'Toastmaster',
  );

  const roleLines = [
    roleNames.generalEvaluator ? `🎯 General Evaluator — ${roleNames.generalEvaluator}` : null,
    roleNames.tableTopicsMaster ? `💡 Table Topics Master — ${roleNames.tableTopicsMaster}` : null,
    roleNames.toastmaster ? `🎤 ${toastmasterLabel} — ${roleNames.toastmaster}` : null,
  ].filter((line): line is string => line !== null);

  const detailLines = [
    `📅 Date: ${CAPTION_DATE_FMT.format(when)}`,
    `🕖 Time: ${CAPTION_TIME_FMT.format(when)}`,
    club.venueAddress ? `📍 Venue: ${club.venueAddress}` : null,
    club.venueMapUrl ? `🗺️ Map: ${club.venueMapUrl}` : null,
  ].filter((line): line is string => line !== null);

  const sections = [
    [`📢 ${ordinal(meeting.meetingNumber)} General Meeting | ${club.name} 🎙️`],
    [
      'Dear Fellow Toastmasters & Guests,',
      'You’re warmly invited to our upcoming regular meeting with the theme:',
      `💬 “${meeting.theme}”`,
    ],
  ];

  if (roleLines.length > 0) {
    sections.push(['✨ Role Players:', ...roleLines]);
  }

  sections.push(detailLines);
  sections.push(['Come join us for an evening of learning, speaking, networking, and growth! 🌟']);

  return sections.map((section) => section.join('\n')).join('\n\n');
}
