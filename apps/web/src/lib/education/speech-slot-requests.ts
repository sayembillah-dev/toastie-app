/** A member asking the VPE for a speaking slot on an upcoming meeting's
 * agenda. The VPE builds the actual agenda elsewhere — this is just the
 * member-facing ask and its status. */

export const SPEECH_SLOT_REQUEST_STATUSES = ['pending', 'approved', 'declined'] as const;

export type SpeechSlotRequestStatus = (typeof SPEECH_SLOT_REQUEST_STATUSES)[number];

export const SPEECH_SLOT_REQUEST_STATUS_LABELS: Record<SpeechSlotRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
};

export const SPEECH_SLOT_REQUEST_NOTE_MAX = 240;

export interface SpeechSlotRequest {
  id: string;
  /** Tenant boundary — copied from the requesting member's club. */
  clubId: string;
  memberId: string;
  meetingId: string;
  projectName?: string;
  note?: string;
  status: SpeechSlotRequestStatus;
  requestedAt: string;
}

/** Body for `POST /speech-slot-requests`. Always lands as `pending` — only
 * the VPE's own review action can move the status. */
export interface CreateSpeechSlotRequestInput {
  meetingId: string;
  projectName?: string;
  note?: string;
}

export const SEED_SPEECH_SLOT_REQUESTS: Omit<SpeechSlotRequest, 'clubId'>[] = [
  {
    id: 'ssr-m-01-1',
    memberId: 'm-01',
    meetingId: 'mtg-011',
    projectName: 'Reflect on Your Path',
    note: 'Happy to go early in the lineup if that helps the running order.',
    status: 'approved',
    requestedAt: '2026-07-28T10:15:00.000Z',
  },
];
