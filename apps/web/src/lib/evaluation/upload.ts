import { fileToDataUrl } from '@/lib/uploads/upload-file';

import type {
  EvaluationUploadSurface,
  SignEvaluationUploadInput,
  SignedEvaluationUpload,
} from './api-types';

/** Puts one evaluator-supplied file (audio recording or image) wherever the
 * server says it should go, and returns the reference to submit alongside
 * the evaluation. Same two-leg shape as `uploadFile` in
 * `lib/uploads/upload-file.ts` — sign, then PUT straight to S3 (or inline as
 * a data URL on `local-db`) — but deliberately doesn't share that function's
 * request path: this one hits the *public* sign endpoint and must never
 * attach an Authorization/context header, since the evaluator has no
 * session at all. `sign` is passed in rather than called here so this stays
 * a plain function callable from `handleSubmit` — RTK Query mutation hooks
 * can only be invoked inside a component body. */
export async function uploadEvaluationFile(
  file: Blob,
  args: {
    meetingId: string;
    speakerId: string;
    token: string;
    surface: EvaluationUploadSurface;
  },
  sign: (input: SignEvaluationUploadInput) => Promise<SignedEvaluationUpload>,
): Promise<string> {
  const mimeType = file.type || 'application/octet-stream';
  const signed = await sign({
    meetingId: args.meetingId,
    speakerId: args.speakerId,
    token: args.token,
    surface: args.surface,
    mimeType,
    sizeBytes: file.size,
  });

  if (signed.mode === 'inline') return fileToDataUrl(file);

  const put = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'content-type': mimeType },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Please try again.`);
  }
  return signed.key;
}
