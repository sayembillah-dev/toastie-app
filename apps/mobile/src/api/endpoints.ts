/**
 * Typed wrappers over the routes in docs/TDD.md section 5. Screens call these; they
 * never build paths themselves, so a route change is a one-file edit.
 */

import { request } from './client';
import type {
  ActivityLogEntry,
  AuthResult,
  Club,
  HistoryEvent,
  Meeting,
  MeetingSummary,
  Prospect,
  Session,
} from './types';

/* ---------------------------------------------------------------- auth --- */

/**
 * Login is by phone number, not email (docs/TDD.md section 6). Email exists on
 * `User` as an optional secondary contact and is not an identifier.
 */
export function login(phone: string, password: string) {
  return request<AuthResult>('auth/login', {
    method: 'POST',
    body: { phone, password },
    anonymous: true,
  });
}

export function fetchSession() {
  return request<Session>('auth/session');
}

export function logout() {
  return request<void>('auth/logout', { method: 'POST' });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<void>('auth/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

/* -------------------------------------------------------------- profile --- */

/**
 * Self-service account deletion, required of any app that lets people
 * register (Google Play's data-deletion policy).
 *
 * `DELETE /profile`, not `DELETE /users` — the latter is the Super Admin
 * removing other people. Answers 204, or 400 `LAST_CLUB_ADMIN` (with the club
 * names in the body) when deleting would leave a club with no administrator.
 */
export function deleteAccount(currentPassword: string) {
  return request<void>('profile', {
    method: 'DELETE',
    body: { currentPassword },
  });
}

/* --------------------------------------------------------------- clubs --- */

export function fetchMyClub() {
  return request<Club>('clubs/mine');
}

/* ------------------------------------------------------------ meetings --- */

export function fetchMeetings() {
  return request<MeetingSummary[]>('meetings');
}

export function fetchMeeting(meetingId: string) {
  return request<Meeting>(`meetings/${meetingId}`);
}

/**
 * The unauthenticated agenda behind a share link (docs/TDD.md section 7.3). Takes no
 * context header and no token — a guest opening this has neither.
 */
export function fetchPublicMeeting(meetingId: string) {
  return request<Meeting>(`public/meetings/${meetingId}`, {
    anonymous: true,
    context: null,
  });
}

/* ----------------------------------------------------------- education --- */

export function fetchMemberHistory(membershipId: string) {
  return request<HistoryEvent[]>(`members/${membershipId}/history`);
}

/* -------------------------------------------------------------- people --- */

export function fetchGuests() {
  return request<Prospect[]>('guests');
}

/* ------------------------------------------------------------ activity --- */

export function fetchActivityLog() {
  return request<ActivityLogEntry[]>('activity-logs');
}
