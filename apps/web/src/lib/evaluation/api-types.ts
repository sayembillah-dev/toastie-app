/** Types for the two-endpoint public evaluation flow
 * (`PublicEvaluationsController` on the API) and the authenticated "what
 * feedback have I received" read. Mirrors the API's DTOs/wire shapes —
 * see `apps/api/src/evaluations/`. */

export type EvaluationUploadSurface = 'evaluationAudio' | 'evaluationImage';

/** Same discriminated union as `StorageService.signUpload` on the API:
 * `s3` hands back a presigned PUT; `inline` means the `local-db` backend has
 * nowhere to put this, so the caller falls back to a data URL. */
export type SignedEvaluationUpload =
  | { mode: 's3'; url: string; key: string; expiresInSeconds: number }
  | { mode: 'inline' };

export interface SignEvaluationUploadInput {
  meetingId: string;
  speakerId: string;
  token: string;
  surface: EvaluationUploadSurface;
  mimeType: string;
  sizeBytes: number;
}

export interface SubmitEvaluationInput {
  meetingId: string;
  speakerId: string;
  token: string;
  evaluatorName: string;
  isAssignedEvaluator: boolean;
  text?: string;
  audioKey?: string;
  audioMimeType?: string;
  audioDurationSec?: number;
  imageKeys?: string[];
}

/** Wire shape for `GET /members/:memberId/received-evaluations`. */
export interface EvaluationSubmissionWire {
  id: string;
  meetingId: string;
  meetingSpeakerId: string;
  meetingNumber: number;
  speechTitle: string;
  evaluatorName: string;
  isAssignedEvaluator: boolean;
  submittedAt: string;
  text?: string;
  audioUrl?: string;
  audioMimeType?: string;
  audioDurationSec?: number;
  imageUrls: string[];
}
