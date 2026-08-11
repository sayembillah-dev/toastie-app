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

/** Builds the WhatsApp/Facebook invite caption shared for a meeting. Venue is
 * left blank until club profile carries a physical address to fill it in. */
export function buildMeetingCaption(
  meeting: Meeting,
  clubName: string,
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

  const lines = [
    `📢 ${ordinal(meeting.meetingNumber)} General Meeting | ${clubName} 🎙️`,
    `Dear Fellow Toastmasters & Guests,`,
    `You’re warmly invited to our upcoming regular meeting with the theme:`,
    `💬 “${meeting.theme}”`,
  ];

  if (roleLines.length > 0) {
    lines.push('✨ Role Players:', ...roleLines);
  }

  lines.push(
    `📅 Date: ${CAPTION_DATE_FMT.format(when)}`,
    `🕖 Time: ${CAPTION_TIME_FMT.format(when)}`,
    `📍 Venue: `,
    '',
    'Come join us for an evening of learning, speaking, networking, and growth! 🌟',
  );

  return lines.join('\n');
}
