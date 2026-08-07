import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

/** Phone-based registration DTO. Phone is the login credential; email
 * is optional contact info. Phone format is deliberately permissive —
 * 8–20 chars, digits with an optional leading `+` and inline `-`/space
 * separators. If we ever need E.164 canonicalisation, add it once at
 * the API boundary rather than trusting client-side normalisation. */
export class RegisterDto {
  @IsString()
  @Matches(/^\+?[0-9\s-]{8,20}$/, {
    message: 'Enter a valid phone number (8–20 digits, optional leading +)',
  })
  @MaxLength(20)
  phone!: string;

  @IsString()
  @Length(1, 80)
  firstName!: string;

  @IsString()
  @Length(1, 80)
  lastName!: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(200)
  password!: string;

  /** Optional — not required to sign up, never used for login. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}
