import { Module } from '@nestjs/common';

import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { PublicEvaluationsController } from './public-evaluations.controller';

@Module({
  controllers: [PublicEvaluationsController, EvaluationsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}
