import { Module } from '@nestjs/common';

import { OrgAssignmentsController } from './org-assignments.controller';
import { OrgAssignmentsService } from './org-assignments.service';

@Module({
  controllers: [OrgAssignmentsController],
  providers: [OrgAssignmentsService],
  exports: [OrgAssignmentsService],
})
export class OrgAssignmentsModule {}
