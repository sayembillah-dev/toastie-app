import { Global, Module } from '@nestjs/common';

import { IdentityService } from './identity.service';

/** `@Global` for the same reason as `PrismaModule`: there is one identity
 * table in the app and every domain module writes toward it — a per-module
 * import would just multiply boilerplate. */
@Global()
@Module({
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
