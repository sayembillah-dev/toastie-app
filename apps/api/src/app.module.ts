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
      envFilePath: ['../../.env.local', '../../.env'],
    }),
    PrismaModule,
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
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
