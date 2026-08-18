import { Module } from '@nestjs/common';

import { EducationController } from './education.controller';
import { EducationService } from './education.service';
import { EvaluationFormsController } from './evaluation-forms.controller';
import { PlannerRowsController } from './planner-rows.controller';
import { PlannerRowsService } from './planner-rows.service';

@Module({
  controllers: [EducationController, PlannerRowsController, EvaluationFormsController],
  providers: [EducationService, PlannerRowsService],
  exports: [EducationService],
})
export class EducationModule {}
