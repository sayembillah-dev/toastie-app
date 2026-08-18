import { readAccessToken, readStoredContext } from '@/lib/auth/token-storage';

/** Mirrors `STORAGE_SURFACES` on the API. The surface is what decides which
 * MIME types and size the server will sign for, so it is not a free-form
 * label — see `apps/api/src/storage/storage.types.ts`. */
export type UploadSurface =
  | 'asset'
  | 'document'
  | 'planner'
  | 'inventory'
  | 'avatar'
  | 'guestAvatar'
  | 'clubBanner';

type SignResponse =
  | { mode: 's3'; url: string; key: string; expiresInSeconds: number }
  | { mode: 'inline' };

/** Reads a file (or any `Blob` — e.g. a `MediaRecorder` audio recording,
 * which never has a `File` wrapper) into a `data:` URL.
 *
 * Still exported because it is the `local-db` backend's entire storage
 * strategy — see the `inline` branch of `uploadFile`. On the `s3` backend
 * nothing calls it. */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** Puts one file wherever the server says it should go, and returns the
 * reference to store on the owning row.
 *
 * Two backends, one call site. On `s3` the return value is an object key and
 * the bytes go straight from the browser to the bucket — they never pass
 * through the API, which is why there is no longer a few-MB ceiling on any of
 * this. On `local-db` the server answers "inline it", and the return value is
 * a base64 data-URL exactly as before S3 existed.
 *
 * Callers store the return value verbatim. They must not try to interpret it:
 * the API resolves a key into a signed, time-limited URL on the way back out,
 * and a data-URL passes through untouched.
 *
 * Not an RTK Query endpoint because the second leg is a cross-origin PUT to
 * AWS that must not carry our `Authorization` header — S3 rejects a request
 * that presents both a signature and a bearer token. */
export async function uploadFile(file: File, surface: UploadSurface): Promise<string> {
  const signed = await requestSignature(file, surface);
  if (signed.mode === 'inline') return fileToDataUrl(file);

  const put = await fetch(signed.url, {
    method: 'PUT',
    // Must match the content type the signature was minted for — S3 compares
    // it against the signed headers and 403s on a mismatch.
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Please try again.`);
  }
  return signed.key;
}

async function requestSignature(file: File, surface: UploadSurface): Promise<SignResponse> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = readAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctx = readStoredContext();
  if (ctx) headers['X-Toastly-Context'] = ctx;

  const res = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers,
    body: JSON.stringify({ surface, mimeType: file.type, sizeBytes: file.size }),
  });

  if (!res.ok) {
    // The API's 400s here are user-facing on purpose ("File is too large —
    // the limit is 25 MB"), so surface the server's wording rather than a
    // generic failure.
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as SignResponse;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message) && typeof body.message[0] === 'string') return body.message[0];
  } catch {
    // Non-JSON error body — fall through to the generic message.
  }
  return `Could not prepare the upload (${res.status})`;
}
