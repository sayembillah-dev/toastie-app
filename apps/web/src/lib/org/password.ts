const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

/** Shared by every SA flow that hands a person a fresh credential — account
 * creation and password reset alike — so both land on the same strength
 * and character set. */
export function generatePassword(length = 14): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('');
}
