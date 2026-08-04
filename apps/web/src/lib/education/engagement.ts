import type { Meeting } from '@/lib/meetings/meetings';

import type { MemberStats } from './history';

export type MemberHealth = 'healthy' | 'at-risk';

/** A member is healthy when they both turn up and pitch in — strictly more than
 * 70% on each. Falls to at-risk otherwise; a new member with no meetings yet
 * lands there too, because we have no signal to say they're engaged. */
export const HEALTH_THRESHOLD_PERCENT = 70;

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

export function computeEngagement(stats: MemberStats, meetings: Meeting[], now: Date): Engagement {
  const meetingsHeld = countMeetingsInWindow(meetings, stats.joinedAt, now);
  const meetingsAttended = Math.min(stats.meetingsAttended, meetingsHeld);
  const attendancePercent =
    meetingsHeld === 0 ? 0 : Math.round((meetingsAttended / meetingsHeld) * 100);

  const activeAppearances = stats.speechesGiven + stats.rolesTaken;
  const activityRatio =
    meetingsAttended === 0 ? 0 : Math.min(1, activeAppearances / meetingsAttended);
  const activityPercent = Math.round(activityRatio * 100);

  const health: MemberHealth =
    attendancePercent > HEALTH_THRESHOLD_PERCENT && activityPercent > HEALTH_THRESHOLD_PERCENT
      ? 'healthy'
      : 'at-risk';

  return { meetingsHeld, meetingsAttended, attendancePercent, activityPercent, health };
}
