import { IsIn, IsString, MaxLength } from 'class-validator';

export const DEVICE_PLATFORMS = ['ios', 'android'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** Body for `POST /devices` — the FCM registration token of this install. */
export class RegisterDeviceDto {
  @IsIn(DEVICE_PLATFORMS)
  platform!: DevicePlatform;

  @IsString()
  @MaxLength(4096)
  token!: string;
}
