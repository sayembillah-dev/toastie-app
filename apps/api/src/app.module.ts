import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Side-effect import: `roles.compat.ts` runs a `Prisma enum ↔ @toastly/access
// union` drift check on module load so a rename in one place fails boot
// instead of surfacing as a runtime 403 later.
import './access/roles.compat';

import { AccessModule } from './access';
import { ActivityModule } from './activity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { ClubsModule } from './clubs';
import { validateEnv } from './config';
import { EducationModule } from './education';
import { FinanceModule } from './finance';
import { HealthController } from './health/health.controller';
import { InventoryModule } from './inventory';
import { InvitesModule } from './invites';
import { JoinRequestsModule } from './join-requests';
import { LibraryModule } from './library';
import { MeetingsModule } from './meetings';
import { MembershipsModule } from './memberships';
import { OrgModule } from './org';
import { OrgAssignmentsModule } from './org-assignments';
import { PeopleModule } from './people';
import { PrismaModule } from './prisma';
import { PushModule } from './push';
import { QueueModule } from './queue';
import { StorageModule } from './storage';
import { TasksModule } from './tasks';
import { UsersModule } from './users';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // A single .env lives at the repo root, shared with apps/web — see
      // next.config.ts's dotenv load. Nest is always started via
      // `pnpm --filter @toastly/api ...`, which sets cwd to this package,
      // so the relative path up to the root is stable across dev/start.
      //
      // In production these paths intentionally resolve to nothing: PM2 runs
      // the app from a release directory whose physical path is
      // /srv/toastly/releases/<sha>/api, so `../../` lands in `releases/`.
      // The ecosystem file injects the real values into `process.env` instead,
      // and @nestjs/config both tolerates missing env files and never
      // overwrites a key already present in the environment.
      envFilePath: ['../../.env.local', '../../.env'],
      // Fail the boot rather than let an unset secret become `undefined`.
      validate: validateEnv,
    }),
    PrismaModule,
    // Global: decides whether background work goes to Redis/BullMQ or stays a
    // no-op, based on APP_ENV. Registered before feature modules so any of them
    // can inject QueueService.
    QueueModule.forRoot(),
    // Global: every module owning a file column injects StorageService in its
    // serializers, so it is registered ahead of the feature modules.
    StorageModule,
    AccessModule,
    ActivityModule,
    AuthModule,
    OrgModule,
    ClubsModule,
    MembershipsModule,
    InvitesModule,
    JoinRequestsModule,
    MeetingsModule,
    EducationModule,
    PeopleModule,
    LibraryModule,
    InventoryModule,
    FinanceModule,
    TasksModule,
    UsersModule,
    OrgAssignmentsModule,
    PushModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
