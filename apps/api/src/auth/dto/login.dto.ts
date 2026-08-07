import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^\+?[0-9\s-]{8,20}$/, {
    message: 'Enter a valid phone number',
  })
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
