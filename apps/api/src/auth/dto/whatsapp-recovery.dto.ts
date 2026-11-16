import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

const toPhone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizePhone(value) : value;

export class WhatsappRecoveryRequestDto {
  @IsString()
  @Transform(toPhone)
  @Matches(PHONE_REGEX, { message: 'Phone must be exactly 11 digits' })
  phone!: string;
}

export class WhatsappRecoveryResetDto {
  @IsString()
  @Transform(toPhone)
  @Matches(PHONE_REGEX, { message: 'Phone must be exactly 11 digits' })
  phone!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code is 6 digits' })
  code!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  newPassword!: string;
}
