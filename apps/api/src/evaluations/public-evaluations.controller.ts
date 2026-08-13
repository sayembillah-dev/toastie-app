import { Body, Controller, Param, Post, Query } from '@nestjs/common';

import { Public } from '@/access';
import type { SignedUpload } from '@/storage';

import { SignEvaluationUploadDto, SubmitEvaluationDto } from './dto/evaluations.dto';
import { EvaluationsService } from './evaluations.service';

/** Anonymous evaluation flow behind a meeting's share link — same trust
 * boundary as `PublicMeetingsController`. `@Public()` skips both
 * `JwtAuthGuard` and `ContextGuard`, so no session is required; the token
 * (`?t=`) is the credential instead, re-checked on every call. */
@Public()
@Controller('public/meetings/:meetingId/speakers/:speakerId/evaluations')
export class PublicEvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Post('sign')
  sign(
    @Param('meetingId') meetingId: string,
    @Param('speakerId') speakerId: string,
    @Query('t') token: string | undefined,
    @Body() dto: SignEvaluationUploadDto,
  ): Promise<SignedUpload> {
    return this.evaluations.signPublicUpload(meetingId, speakerId, token, dto);
  }

  @Post()
  submit(
    @Param('meetingId') meetingId: string,
    @Param('speakerId') speakerId: string,
    @Query('t') token: string | undefined,
    @Body() dto: SubmitEvaluationDto,
  ): Promise<{ id: string }> {
    return this.evaluations.submitPublicEvaluation(meetingId, speakerId, token, dto);
  }
}
