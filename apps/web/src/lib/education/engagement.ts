import type { Meeting } from '@/lib/meetings/meetings';
import { dhakaDateKey, dhakaInstant } from '@/lib/time';

import type { MemberStats } from './history';
import type { Member } from './members';

export type MemberHealth = 'healthy' | 'at-risk';

/** Floor on the at-risk threshold, in speaking meetings — however many
 * slots a club runs, nobody is flagged sooner than this. */
export const MIN_AT_RISK_MEETINGS = 6;

export interface Engagement {
  /** Meetings on the roster whose start falls between joinedAt and `now`. */
  meetingsHeld: number;
  /** Meetings attended, capped by `meetingsHeld` so the ratio can never exceed
   * one — the local seed has more attendance recorded than meetings on the
   * roster, and the cap keeps the story honest. */
  meetingsAttended: number;
  attendancePercent: number;
  /** Share of attended meetings where the member gave a speech or took a role.
   * `min(1, …)` guards against a single meeting counting twice (speech + role)
   * pushing the ratio past 100%. */
  activityPercent: number;
  health: MemberHealth;
}

function countMeetingsInWindow(meetings: Meeting[], joinedAt: string, now: Date): number {
  const joinTime = dhakaInstant(joinedAt).getTime();
  const nowTime = now.getTime();
  return meetings.reduce((total, meeting) => {
    const start = new Date(meeting.dateTime).getTime();
    return start >= joinTime && start <= nowTime ? total + 1 : total;
  }, 0);
}

/** Meetings without a delivered speech (contest nights, socials, cancelled
 * agendas) offered no slot to miss, so only these count toward the gap. */
function speakingMeetings(meetings: Meeting[], now: Date): Meeting[] {
  const nowTime = now.getTime();
  return meetings.filter(
    (m) => (m.speechCount ?? 0) > 0 && new Date(m.dateTime).getTime() <= nowTime,
  );
}

/** Speaking meetings a member can go without speaking before they're
 * at-risk: one full fair turn. A club with 16 members and ~2 speeches a
 * meeting can only give each member a turn every ~8 meetings, so a fixed
 * number would flag people merely waiting their turn — the threshold scales
 * with the club's own pace.
 * Null when the club has no delivered speeches yet to measure a pace from. */
export function atRiskThreshold(
  meetings: Meeting[],
  activeMembers: number,
  now: Date,
): number | null {
  const held = speakingMeetings(meetings, now);
  if (held.length === 0) return null;
  const speeches = held.reduce((total, m) => total + (m.speechCount ?? 0), 0);
  const fairTurnGap = activeMembers / (speeches / held.length);
  return Math.max(MIN_AT_RISK_MEETINGS, Math.ceil(fairTurnGap));
}

/** At-risk once the member has sat through `atRiskThreshold` speaking
 * meetings without a speech — counted from their latest speech, or from
 * joining if they've never spoken. Attendance plays no part — it isn't
 * recorded reliably enough to judge on. */
function computeHealth(
  stats: MemberStats,
  meetings: Meeting[],
  activeMembers: number,
  now: Date,
): MemberHealth {
  const threshold = atRiskThreshold(meetings, activeMembers, now);
  if (threshold === null) return 'healthy';
  // "YYYY-MM-DD" strings in Bangladesh compare correctly as plain strings.
  // The meeting a member spoke at doesn't count against them; the one held
  // on the day they joined does — they could have been given a slot there.
  const missed = speakingMeetings(meetings, now).filter((m) => {
    const day = dhakaDateKey(m.dateTime);
    return stats.latestSpeech
      ? day > stats.latestSpeech.date.slice(0, 10)
      : day >= stats.joinedAt.slice(0, 10);
  }).length;
  return missed >= threshold ? 'at-risk' : 'healthy';
}

/** Active roster size — the `activeMembers` argument to `computeEngagement`. */
export function countActive(members: Member[]): number {
  return members.filter((m) => m.status === 'active').length;
}

/** `activeMembers` is the club's active roster size — it sets the speaking
 * pace the health threshold is judged against. */
export function computeEngagement(
  stats: MemberStats,
  meetings: Meeting[],
  activeMembers: number,
  now: Date,
): Engagement {
  const meetingsHeld = countMeetingsInWindow(meetings, stats.joinedAt, now);
  const meetingsAttended = Math.min(stats.meetingsAttended, meetingsHeld);
  const attendancePercent =
    meetingsHeld === 0 ? 0 : Math.round((meetingsAttended / meetingsHeld) * 100);

  const activeAppearances = stats.speechesGiven + stats.rolesTaken;
  const activityRatio =
    meetingsAttended === 0 ? 0 : Math.min(1, activeAppearances / meetingsAttended);
  const activityPercent = Math.round(activityRatio * 100);

  const health = computeHealth(stats, meetings, activeMembers, now);

  return { meetingsHeld, meetingsAttended, attendancePercent, activityPercent, health };
}
