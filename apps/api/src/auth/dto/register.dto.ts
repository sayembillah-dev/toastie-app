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

  /** The single "Full name" input — split on the first space server-side
   * (`splitFullName`). Wins over the legacy pair when both are sent. Cap is
   * 80 + 80 + the joining space. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 161)
  name?: string;

  /** Legacy pair — optional now that `name` is the canonical input; the
   * service rejects a submission that carries neither. */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

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
