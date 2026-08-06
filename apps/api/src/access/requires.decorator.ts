import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { Action, ResourceKey } from '@toastly/access';

/** Metadata key read by `PermissionGuard`. The value is the `{ resource,
 * action }` pair a handler is guarding — anything else on the request is
 * derived (subject from the JWT, target from the resolved `X-Toastly-Context`). */
export const REQUIRES_METADATA = 'toastly:requires';

/** Metadata key read by every guard to short-circuit into an anonymous path
 * (login/register, public share endpoints). Only guards check this; setting
 * it on a controller alone does nothing without matching guard support. */
export const PUBLIC_METADATA = 'toastly:public';

export interface RequiresMetadata {
  resource: ResourceKey;
  action: Action;
}

/** Tag a route as requiring `resource:action`. The coarse check runs pre-
 * handler; the fine `own`-scoped check (once a row is loaded) is the
 * service's job. See §2.5 of the plan for the two-phase rationale. */
export function Requires(resource: ResourceKey, action: Action): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(REQUIRES_METADATA, { resource, action } satisfies RequiresMetadata),
  );
}

/** Skip auth + context + permission guards. Reserved for `/auth/register`,
 * `/auth/login`, `/auth/refresh` and the public share endpoints added in
 * S13. Any other use is a hole and should be reviewed. */
export function Public(): MethodDecorator & ClassDecorator {
  return SetMetadata(PUBLIC_METADATA, true);
}
