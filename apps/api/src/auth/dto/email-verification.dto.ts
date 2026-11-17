import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SendEmailCodeDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email!: string;

  /** Ignored. Older app builds still send it; a signed-in session is
   * enough to add, change or verify the email (product decision,
   * 2026-11-17). The old verified address still gets an "email changed"
   * notice when the address moves. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;
}

export class VerifyEmailDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code is 6 digits' })
  code!: string;
}
