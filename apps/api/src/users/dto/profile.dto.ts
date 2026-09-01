import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

/** Same catalogue as `guests.dto.ts`'s `SOCIAL_PLATFORMS` — kept as its own
 * copy rather than a shared import since a profile and a guest are
 * unrelated resources that happen to shape socials the same way. */
export const PROFILE_SOCIAL_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'youtube',
  'twitter',
  'tiktok',
  'website',
  'other',
] as const;

class ProfileSocialDto {
  @IsIn(PROFILE_SOCIAL_PLATFORMS as readonly string[])
  platform!: string;

  @IsString()
  @MaxLength(400)
  url!: string;
}

/** Body for `PATCH /profile` — the account holder editing their own
 * identity/contact/bio fields. `currentPassword` isn't validated here as
 * required-when-present; `UsersService.updateProfile` enforces it only when
 * `email` or `phone` is being changed, since those are the fields that
 * double as sign-in/contact credentials. */
export class UpdateProfileDto {
  /** Single "Full name" input — split server-side, wins over the pair. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(161)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === undefined ? value : normalizePhone(value)))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ProfileSocialDto)
  socials?: ProfileSocialDto[];

  /** Required by the service whenever `email` or `phone` is present —
   * re-confirms the account holder's identity before a credential change. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;
}

/** Body for `DELETE /profile` — the account holder deleting their own
 * account. The password is re-confirmed for the same reason
 * `UpdateProfileDto` demands it on a credential change, only more so: this
 * is irreversible, and an unlocked phone left on a table should not be
 * enough to destroy someone's account. */
export class DeleteAccountDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;
}
