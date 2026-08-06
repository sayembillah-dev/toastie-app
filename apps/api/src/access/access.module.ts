import { Global, Module } from '@nestjs/common';

import { ClubLineageCache } from './club-lineage.cache';
import { ContextGuard } from './context.guard';
import { PermissionGuard } from './permission.guard';
import { SubjectFactory } from './subject.factory';

/** `@Global` because every domain module needs `SubjectFactory` to build
 * responses off the caller's session, and the guards are registered
 * globally in `app.module.ts` via `APP_GUARD`. Keeping providers in one
 * module keeps the dependency graph readable — auth wires into access,
 * not the other way. */
@Global()
@Module({
  providers: [SubjectFactory, ClubLineageCache, ContextGuard, PermissionGuard],
  exports: [SubjectFactory, ClubLineageCache, ContextGuard, PermissionGuard],
})
export class AccessModule {}
