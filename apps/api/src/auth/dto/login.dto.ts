import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

export class LoginDto {
  @IsString()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
