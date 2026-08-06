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
import { PeopleModule } from './people';
import { PrismaModule } from './prisma';
import { TasksModule } from './tasks';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
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
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
