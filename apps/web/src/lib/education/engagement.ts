import type { Meeting } from '@/lib/meetings/meetings';

import type { MemberStats } from './history';

export type MemberHealth = 'healthy' | 'at-risk';

/** A member is at-risk when they haven't given a speech in this many months.
 * Attendance plays no part — it isn't recorded reliably enough to judge on. */
export const AT_RISK_SPEECH_GAP_MONTHS = 2;

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
  const joinTime = new Date(`${joinedAt}T00:00:00`).getTime();
  const nowTime = now.getTime();
  return meetings.reduce((total, meeting) => {
    const start = new Date(meeting.dateTime).getTime();
    return start >= joinTime && start <= nowTime ? total + 1 : total;
  }, 0);
}

function monthsBefore(now: Date, months: number): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

/** At-risk only when the member has had a full window to speak and hasn't.
 * Anyone who joined inside the window is new, so they stay healthy. */
function computeHealth(stats: MemberStats, now: Date): MemberHealth {
  const cutoff = monthsBefore(now, AT_RISK_SPEECH_GAP_MONTHS).getTime();
  const joinTime = new Date(`${stats.joinedAt}T00:00:00`).getTime();
  if (joinTime > cutoff) return 'healthy';
  if (!stats.latestSpeech) return 'at-risk';
  const speechTime = new Date(`${stats.latestSpeech.date}T00:00:00`).getTime();
  return speechTime >= cutoff ? 'healthy' : 'at-risk';
}

export function computeEngagement(stats: MemberStats, meetings: Meeting[], now: Date): Engagement {
  const meetingsHeld = countMeetingsInWindow(meetings, stats.joinedAt, now);
  const meetingsAttended = Math.min(stats.meetingsAttended, meetingsHeld);
  const attendancePercent =
    meetingsHeld === 0 ? 0 : Math.round((meetingsAttended / meetingsHeld) * 100);

  const activeAppearances = stats.speechesGiven + stats.rolesTaken;
  const activityRatio =
    meetingsAttended === 0 ? 0 : Math.min(1, activeAppearances / meetingsAttended);
  const activityPercent = Math.round(activityRatio * 100);

  const health = computeHealth(stats, now);

  return { meetingsHeld, meetingsAttended, attendancePercent, activityPercent, health };
}
