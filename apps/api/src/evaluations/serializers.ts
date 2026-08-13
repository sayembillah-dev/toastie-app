import type { EvaluationSubmission } from '@prisma/client';

import type { StorageService } from '@/storage';

/** Row shape the service must select — carries just enough of the parent
 * meeting/speaker to label a card on the Me page without a second round
 * trip (meeting number, speech title). */
export type EvaluationSubmissionRow = EvaluationSubmission & {
  meeting: { meetingNumber: number };
  meetingSpeaker: { title: string };
};

/** Wire shape for `GET /members/:memberId/received-evaluations`. Field names
 * (`audioUrl`/`imageUrls`, not `...Key(s)`) deliberately match what the old
 * localStorage-backed `StoredEvaluationSubmission` used for
 * `audioDataUrl`/`imageDataUrls` — the client only had to rename, not
 * restructure, when this replaced the placeholder. */
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

/** Resolves `audioKey`/`imageKeys` to presigned GETs (or passes a legacy
 * inline `data:` value through untouched) — same async-serializer pattern as
 * every other surface converted to S3. */
export async function toEvaluationSubmissionWire(
  row: EvaluationSubmissionRow,
  storage: StorageService,
): Promise<EvaluationSubmissionWire> {
  const [audioUrl, imageUrls] = await Promise.all([
    storage.resolveOptional(row.audioKey),
    Promise.all(row.imageKeys.map((key) => storage.resolveUrl(key))),
  ]);

  const wire: EvaluationSubmissionWire = {
    id: row.id,
    meetingId: row.meetingId,
    meetingSpeakerId: row.meetingSpeakerId,
    meetingNumber: row.meeting.meetingNumber,
    speechTitle: row.meetingSpeaker.title,
    evaluatorName: row.evaluatorName,
    isAssignedEvaluator: row.isAssignedEvaluator,
    submittedAt: row.submittedAt.toISOString(),
    imageUrls,
  };
  if (row.text) wire.text = row.text;
  if (audioUrl) wire.audioUrl = audioUrl;
  if (row.audioMimeType) wire.audioMimeType = row.audioMimeType;
  if (row.audioDurationSec != null) wire.audioDurationSec = row.audioDurationSec;
  return wire;
}
