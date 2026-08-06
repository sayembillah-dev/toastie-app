import { Module } from '@nestjs/common';

import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { DistrictsController } from './districts.controller';
import { DistrictsService } from './districts.service';
import { DivisionsController } from './divisions.controller';
import { DivisionsService } from './divisions.service';

/** Districts, divisions, areas — the three levels above a Club. Cluster them
 * in a single module so tests and future refactors can inject them together
 * (the reparent transactions cross layers). */
@Module({
  controllers: [DistrictsController, DivisionsController, AreasController],
  providers: [DistrictsService, DivisionsService, AreasService],
  exports: [DistrictsService, DivisionsService, AreasService],
})
export class OrgModule {}
