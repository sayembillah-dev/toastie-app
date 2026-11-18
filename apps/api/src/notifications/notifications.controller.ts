import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';

import { AllowUnverifiedEmail, type AuthenticatedUser, CurrentUser } from '@/auth';

import { ListNotificationsQueryDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';
import type { NotificationPageWire } from './serializers';

/** The signed-in user's own notifications. Account-scoped like `/push`: no
 * `@Requires(...)` and no club context — the list spans every club the
 * person belongs to, and each row carries its own `clubId`. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationPageWire> {
    return this.notifications.list(user.id, query);
  }

  /** Polled by the header badge. Open behind the email gate so the poll
   * doesn't keep re-triggering the gate's 403 while it's showing. */
  @Get('unread-count')
  @AllowUnverifiedEmail()
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }
}
