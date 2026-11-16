import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignupSendCodeDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email!: string;
}

export class SignupVerifyDto {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code is 6 digits' })
  code!: string;
}
