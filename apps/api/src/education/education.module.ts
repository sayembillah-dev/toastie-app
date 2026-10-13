import { Module } from '@nestjs/common';

import { MeetingsModule } from '@/meetings';

import { EducationController } from './education.controller';
import { EducationService } from './education.service';
import { EvaluationFormsController } from './evaluation-forms.controller';
import { PlannerRowsController } from './planner-rows.controller';
import { PlannerRowsService } from './planner-rows.service';

@Module({
  imports: [MeetingsModule],
  controllers: [EducationController, PlannerRowsController, EvaluationFormsController],
  providers: [EducationService, PlannerRowsService],
  exports: [EducationService],
})
export class EducationModule {}
