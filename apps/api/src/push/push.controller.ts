import { Body, Controller, Post } from '@nestjs/common';

import { type AuthenticatedUser, CurrentUser } from '@/auth';

import { SubscribePushDto, UnsubscribePushDto } from './dto/push.dto';
import { PushService } from './push.service';

/** Self-service Web Push subscription management — same trust boundary as
 * `ProfileController`: no `@Requires(...)`, any signed-in user manages their
 * own device subscriptions. */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubscribePushDto): Promise<void> {
    return this.push.subscribe(user.id, dto);
  }

  @Post('unsubscribe')
  unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnsubscribePushDto,
  ): Promise<void> {
    return this.push.unsubscribe(user.id, dto.endpoint);
  }
}
