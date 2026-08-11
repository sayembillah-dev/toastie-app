import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

/** Phone-based registration DTO. Phone is the login credential; email
 * is optional contact info. Local Bangladeshi format only — exactly 11
 * digits after stripping spaces/dashes/country-code prefix. */
export class RegisterDto {
  @IsString()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone!: string;

  @IsString()
  @Length(1, 80)
  firstName!: string;

  @IsString()
  @Length(1, 80)
  lastName!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  password!: string;

  /** Optional — not required to sign up, never used for login. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}
