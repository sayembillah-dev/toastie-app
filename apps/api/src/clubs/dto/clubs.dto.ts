import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

const NAME_MAX = 80;
const CLUB_NUMBER_MAX = 20;
const MOTTO_MAX = 300;
const VENUE_ADDRESS_MAX = 500;
const VENUE_MAP_URL_MAX = 500;

/** Mirrors `ORG_CLUB_STATUSES` in `lib/org/types.ts` — the wire enum the web
 * UI still uses. Maps 1:1 to Prisma's `ClubDirectoryStatus`. */
export const ORG_CLUB_STATUSES = ['active', 'low', 'suspended'] as const;
export type OrgClubStatus = (typeof ORG_CLUB_STATUSES)[number];

export class CreateOrgClubDto {
  @IsString()
  @MinLength(1)
  areaId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CLUB_NUMBER_MAX)
  clubNumber?: string;

  @IsOptional()
  @IsEnum(ORG_CLUB_STATUSES)
  status?: OrgClubStatus;
}

/** Body for `POST /clubs/join-by-code`. Codes are 8 unambiguous characters
 * (see `ClubsService.randomJoinCode`) but the field accepts a looser range
 * so a stray space or lowercase paste doesn't 400 before normalisation. */
export class JoinByCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  code!: string;
}

export class UpdateOrgClubDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name?: string;

  /** `null` explicitly clears the number; `undefined` leaves it alone. */
  @IsOptional()
  @IsString()
  @MaxLength(CLUB_NUMBER_MAX)
  clubNumber?: string | null;

  @IsOptional()
  @IsEnum(ORG_CLUB_STATUSES)
  status?: OrgClubStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  areaId?: string;
}

/** Same catalogue as `apps/api/src/users/dto/profile.dto.ts`'s
 * `PROFILE_SOCIAL_PLATFORMS` — kept as its own copy since a club's official
 * links and a person's profile links are unrelated resources that happen to
 * shape socials the same way. */
export const CLUB_SOCIAL_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'youtube',
  'twitter',
  'tiktok',
  'website',
  'other',
] as const;

class ClubSocialDto {
  @IsIn(CLUB_SOCIAL_PLATFORMS as readonly string[])
  platform!: string;

  @IsString()
  @MaxLength(400)
  url!: string;
}

/** Position of a custom agenda banner image inside the fixed banner frame.
 * `x`/`y` are CSS background-position percentages; `zoom` multiplies the
 * cover fit (1 = exactly cover); `aspect` is the image's natural width /
 * height, stored at upload time so the print renderer can size the image
 * without fetching it. */
class BannerImagePosDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;

  @IsNumber()
  @Min(1)
  @Max(8)
  zoom!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(20)
  aspect?: number;
}

/** Body for `PATCH /clubs/mine` — a Club Admin editing their own club's
 * profile. `null` explicitly clears a field; `undefined` leaves it alone,
 * same convention as `UpdateOrgClubDto.clubNumber`. */
export class UpdateClubProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CLUB_NUMBER_MAX)
  clubNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MOTTO_MAX)
  motto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(VENUE_ADDRESS_MAX)
  venueAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(VENUE_MAP_URL_MAX)
  venueMapUrl?: string | null;

  /** `null` clears the number; `undefined` leaves it alone. Same 11-digit
   * local format as `UpdateProfileDto.phone`, but never a credential — no
   * `currentPassword` re-confirmation needed. */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === undefined || value === null ? value : normalizePhone(value)))
  @Matches(PHONE_REGEX, { message: 'Phone must be exactly 11 digits' })
  contactPhone?: string | null;

  /** Hex colour for the printed agenda banner strip — `#003366` style.
   * `null` restores the default navy. */
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Banner colour must be a hex code like #003366' })
  bannerColor?: string | null;

  /** Storage key (or inline data-URL on the local backend) for a custom
   * agenda banner image — same convention as `UpdateProfileDto.avatarUrl`.
   * `null` removes the image. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  bannerImage?: string | null;

  /** The crop the admin dragged into place, persisted alongside
   * `bannerImage` so the printed sheet matches the settings preview.
   * `null` resets it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => BannerImagePosDto)
  bannerImagePos?: BannerImagePosDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ClubSocialDto)
  socials?: ClubSocialDto[];
}
