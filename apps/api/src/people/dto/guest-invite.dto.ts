import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

/** Body for `POST /public/guest-invites/:token` — the public self-signup
 * form deliberately asks for exactly two things: a name and a mobile
 * number. The service splits `name` into the prospect's first/last name
 * (first word vs. the rest); anything more can be captured later from the
 * authed guest profile. */
export class SubmitGuestInviteDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(121)
  name!: string;

  @IsString()
  @Transform(({ value }) => (value === undefined ? value : normalizePhone(value)))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone!: string;
}
