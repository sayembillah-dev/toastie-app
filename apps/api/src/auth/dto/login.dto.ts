import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

/** Sign in with `email` (the new way) or `phone` (older accounts, and app
 * builds that only know the phone) — exactly one of the two. The service
 * answers 400 `LOGIN_IDENTIFIER_REQUIRED` when both or neither are sent. */
export class LoginDto {
  @ValidateIf((dto: LoginDto) => dto.email !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email?: string;

  @ValidateIf((dto: LoginDto) => dto.phone !== undefined)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
