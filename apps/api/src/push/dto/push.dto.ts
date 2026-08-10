import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class PushSubscriptionKeysDto {
  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @MaxLength(200)
  auth!: string;
}

/** Body for `POST /push/subscribe` — the shape `PushSubscription.toJSON()`
 * produces in the browser (see `lib/push/push-notifications.ts` on the web
 * side). `expirationTime` isn't accepted; it isn't persisted. */
export class SubscribePushDto {
  @IsString()
  @MaxLength(500)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}

/** Body for `POST /push/unsubscribe` — only the endpoint is needed to find
 * and delete the matching row. */
export class UnsubscribePushDto {
  @IsString()
  @MaxLength(500)
  endpoint!: string;
}
