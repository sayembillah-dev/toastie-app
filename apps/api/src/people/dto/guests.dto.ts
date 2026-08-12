import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';
import { OFFICER_ROLES, type OfficerRole } from '@/memberships';

export const GUEST_STAGES = [
  'new',
  'contacted',
  'interested',
  'joined-meetings',
  'joined-club',
  'not-interested',
] as const;
export type GuestStage = (typeof GUEST_STAGES)[number];

export const SOCIAL_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'youtube',
  'twitter',
  'tiktok',
  'website',
  'other',
] as const;

class GuestSocialDto {
  @IsIn(SOCIAL_PLATFORMS as readonly string[])
  platform!: string;

  @IsString()
  @MaxLength(400)
  url!: string;
}

/** Body for `PATCH /guests/:guestId`. Every field is optional so the Kanban
 * drop, mobile dropdown, and edit panel can share this shape. */
export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  // No `@MinLength` — a guest may have no last name on record, and an empty
  // string is how the edit panel clears one.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Empty string clears the field (Prospect.phone is nullable) — normalized
  // to `null` so `@IsOptional()` skips the digit-count check for a clear.
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (value === undefined) return value;
    const normalized = normalizePhone(value);
    return normalized === '' ? null : normalized;
  })
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (value === undefined) return value;
    const normalized = normalizePhone(value);
    return normalized === '' ? null : normalized;
  })
  @Matches(PHONE_REGEX, {
    message: 'WhatsApp number must be exactly 11 digits',
  })
  whatsapp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GuestSocialDto)
  socials?: GuestSocialDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invitedBy?: string;

  @IsOptional()
  @IsIn(GUEST_STAGES as readonly string[])
  stage?: GuestStage;
}

/** Body for `POST /guests`. No `stage` — every guest starts at `new` — and no
 * visit stats, which are derived from `VisitLog` rows (see `visit-stats.ts`)
 * rather than typed in by hand. */
export class CreateGuestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  // Optional: the quick-add drawer only insists on a first name. Stored as an
  // empty string rather than null so `Prospect.lastName` stays non-nullable.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsEmail()
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
  @Transform(({ value }) => (value === undefined ? value : normalizePhone(value)))
  @Matches(PHONE_REGEX, {
    message: 'WhatsApp number must be exactly 11 digits',
  })
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GuestSocialDto)
  socials?: GuestSocialDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invitedBy?: string;
}

/** Body for `POST /guests/:guestId/convert-to-member`. */
export class ConvertGuestDto {
  @IsOptional()
  @IsArray()
  @IsIn(OFFICER_ROLES as readonly string[], { each: true })
  roles?: OfficerRole[];
}
