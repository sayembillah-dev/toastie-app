import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth';
import { MembershipsModule } from '@/memberships';

import { UserMembershipsController } from './user-memberships.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, MembershipsModule],
  controllers: [UsersController, UserMembershipsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
