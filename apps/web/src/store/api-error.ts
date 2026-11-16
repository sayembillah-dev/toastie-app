/** Pulls a human-readable line out of whatever RTK Query hands back — our local
 * `{ status, data: { message } }` today, a `fetchBaseQuery` rejection or a
 * serialized thrown error later. Keeps the try/catch noise out of components. */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof error !== 'object' || error === null) return fallback;

  if ('data' in error) {
    const { data } = error as { data: unknown };
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const { message } = data as { message: unknown };
      if (typeof message === 'string') return message;
      // class-validator's `ValidationPipe` returns `message` as a string
      // array — join it rather than falling through to `fallback` and
      // hiding the actual reason the request was rejected.
      if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
        if (message.length > 0) return (message as string[]).join(' ');
      }
    }
  }

  if ('message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message;
  }

  return fallback;
}

/** Per-field validation messages from the API's `ValidationPipe`
 * (`{ fields: { phone: ['Phone must be exactly 11 digits'] } }`) — `null`
 * when the error isn't a field-validation failure (e.g. a 409 conflict,
 * or a plain string/message error). Field names match the DTO property
 * names, which line up with the form's `Form.Item name=` in every form
 * that submits that DTO. */
export function getFieldErrors(error: unknown): Record<string, string[]> | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null;
  const { data } = error as { data: unknown };
  if (typeof data !== 'object' || data === null || !('fields' in data)) return null;
  const { fields } = data as { fields: unknown };
  if (typeof fields !== 'object' || fields === null) return null;
  const entries = Object.entries(fields as Record<string, unknown>).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) &&
      entry[1].every((m) => typeof m === 'string') &&
      entry[1].length > 0,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** True when the request failed because the record does not exist. */
export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 404
  );
}

/** The API's machine-readable error code (`{ code: 'OTP_INVALID' }`), or
 * `null` when the error carries none — a network failure, or the rate
 * limiter's plain 429. */
export function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null;
  const { data } = error as { data: unknown };
  if (typeof data !== 'object' || data === null) return null;
  const { code } = data as { code?: unknown };
  return typeof code === 'string' ? code : null;
}

/** The HTTP status of a failed request, or `null` for a network failure. */
export function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  const { status } = error as { status: unknown };
  return typeof status === 'number' ? status : null;
}

/** True when the API (or its rate limiter) asked the caller to slow down. */
export function isRateLimited(error: unknown): boolean {
  return getErrorStatus(error) === 429;
}
