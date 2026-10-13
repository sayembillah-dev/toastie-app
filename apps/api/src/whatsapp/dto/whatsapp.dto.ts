import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

import { normalizePhone } from '@/common';

export class SendWhatsappTestDto {
  /** Same 11-digit local format as every other phone in the app. */
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(/^01\d{9}$/, { message: 'Phone must be an 11-digit mobile number, e.g. 01712345678' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text!: string;
}
