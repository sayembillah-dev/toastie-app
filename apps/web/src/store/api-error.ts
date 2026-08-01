/** Pulls a human-readable line out of whatever RTK Query hands back — our local
 * `{ status, data: { message } }` today, a `fetchBaseQuery` rejection or a
 * serialized thrown error later. Keeps the try/catch noise out of components. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error !== 'object' || error === null) return fallback;

  if ('data' in error) {
    const { data } = error as { data: unknown };
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const { message } = data as { message: unknown };
      if (typeof message === 'string') return message;
    }
  }

  if ('message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message;
  }

  return fallback;
}

/** True when the request failed because the record does not exist. */
export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'status' in error && (error as { status: unknown }).status === 404
  );
}
