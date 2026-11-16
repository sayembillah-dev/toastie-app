import { SetMetadata } from '@nestjs/common';

/** Metadata key read by `EmailVerifiedGuard`. */
export const ALLOW_UNVERIFIED_EMAIL_METADATA = 'toastly:allow-unverified-email';

/** Lets a signed-in account with no verified email reach this route while
 * the "verify your email" gate is on. Keep the list short: the session,
 * sign-out, password, `/auth/email/*` and device (push) routes — what a
 * client needs to show the gate, sign out, or clean up. Anything else is a
 * hole in the gate. */
export function AllowUnverifiedEmail(): MethodDecorator & ClassDecorator {
  return SetMetadata(ALLOW_UNVERIFIED_EMAIL_METADATA, true);
}
