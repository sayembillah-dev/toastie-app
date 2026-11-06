import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth';
import { MembershipsModule } from '@/memberships';

import { CredentialShareService } from './credential-share';
import { ProfileController } from './profile.controller';
import { PublicUsersController } from './public-users.controller';
import { UserMembershipsController } from './user-memberships.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, MembershipsModule],
  controllers: [
    UsersController,
    UserMembershipsController,
    PublicUsersController,
    ProfileController,
  ],
  providers: [UsersService, CredentialShareService],
  exports: [UsersService],
})
export class UsersModule {}
