import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

/** Body for `POST /public/guest-invites/:token` — the public self-signup
 * form requires exactly two things: a name and a mobile number. Where they
 * work / what they do (`organization`) and a short intro (`bio`) are
 * optional extras. The service splits `name` into the prospect's first/last
 * name (first word vs. the rest); anything more can be captured later from
 * the authed guest profile. */
export class SubmitGuestInviteDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(161)
  name!: string;

  @IsString()
  @Transform(({ value }) => (value === undefined ? value : normalizePhone(value)))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone!: string;

  /** Where they work or what they do — e.g. "Doctor at DMCH", "CSE student,
   * BUET". Optional. */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(120)
  organization?: string;

  /** A sentence or two about themselves or what brings them to the club.
   * Optional; the cap mirrors the authed guest DTOs. */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000)
  bio?: string;
}
