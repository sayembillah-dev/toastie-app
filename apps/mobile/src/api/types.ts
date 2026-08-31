/**
 * Response shapes for the endpoints this client calls.
 *
 * Derived from docs/ERD.md's field lists and docs/TDD.md section 5's route map, not from
 * a published schema — the API has no OpenAPI document in the docs set. Fields
 * are typed as the ERD describes them; anything the ERD calls nullable is
 * nullable here. Where the API's actual envelope differs, fix it here rather
 * than at call sites, so the correction lands in one place.
 */

import type { SessionResponse } from '@toastly/access';
import type {
  ClubJoinPolicy,
  HistoryEventType,
  MeetingStatus,
  ProspectStage,
} from '@/domain/enums';

/**
 * The session contract is part of the shared access package
 * (`session-dto.ts`), so it is re-exported rather than restated. Everything
 * below this point is API-response shape that lives only in the API.
 */
export type {
  ActiveContextKey,
  SessionMembership,
  SessionOrgAssignment,
  SessionResponse,
  SessionUser,
} from '@toastly/access';

/** Alias kept for readability at call sites. */
export type Session = SessionResponse;

export type IssuedTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Opaque, not a JWT. The API stores only its hash (docs/ERD.md section 4.1). */
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

/**
 * What `POST auth/login`, `auth/register` and `auth/refresh` all return.
 *
 * Note it carries the whole session, not just the user — the API does this
 * deliberately so a client can hydrate without a follow-up `auth/session`
 * round trip. Worth using: it removes a request from the sign-in path, which
 * is the one moment the user is watching a spinner.
 */
export type AuthResult = {
  tokens: IssuedTokens;
  session: SessionResponse;
};

export type Club = {
  id: string;
  name: string;
  slug: string;
  clubNumber: string | null;
  motto: string | null;
  venueAddress: string | null;
  venueMapUrl: string | null;
  contactPhone: string | null;
  bannerColor: string | null;
  bannerImage: string | null;
  joinPolicy: ClubJoinPolicy;
  areaId: string | null;
  divisionId: string | null;
  districtId: string | null;
};

/** A person in a meeting slot: a roster member or a guest, never both. */
export type MeetingActor = {
  membershipId: string | null;
  prospectId: string | null;
  name: string;
  avatarUrl: string | null;
};

export type MeetingRoleAssignment = {
  id: string;
  meetingId: string;
  /** e.g. `toastmaster`, `timer`, `ahCounter`, `grammarian`. */
  roleKey: string;
  actor: MeetingActor | null;
};

export type MeetingSpeaker = {
  id: string;
  meetingId: string;
  /** 1 to 3 (docs/ERD.md section 4.5). */
  order: number;
  title: string | null;
  duration: number | null;
  pathway: string | null;
  project: string | null;
  notes: string | null;
  status: string;
  speaker: MeetingActor | null;
  evaluator: MeetingActor | null;
};

export type TableTopicQuestion = {
  id: string;
  meetingId: string;
  text: string;
  asked: boolean;
};

export type MeetingSummary = {
  id: string;
  clubId: string;
  meetingNumber: number;
  dateTime: string;
  theme: string | null;
  status: MeetingStatus;
};

export type Meeting = MeetingSummary & {
  word: string | null;
  wordPartOfSpeech: string | null;
  wordMeaning: string | null;
  wordExample: string | null;
  shareToken: string;
  roleAssignments: MeetingRoleAssignment[];
  speakers: MeetingSpeaker[];
  tableTopicQuestions: TableTopicQuestion[];
};

export type HistoryEvent = {
  id: string;
  membershipId: string;
  type: HistoryEventType;
  date: string;
  meetingNumber: number | null;
  role: string | null;
  title: string | null;
  projectName: string | null;
  level: number | null;
  pathway: string | null;
};

export type Prospect = {
  id: string;
  clubId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  stage: ProspectStage;
  firstVisit: string | null;
  lastVisit: string | null;
  visitCount: number;
  avatarUrl: string | null;
};

export type ActivityLogEntry = {
  id: string;
  clubId: string;
  actorMembershipId: string | null;
  category: string;
  action: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};
