import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const NAME_MAX = 80;
const CODE_MAX = 12;

export class CreateDistrictDto {
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(CODE_MAX)
  code!: string;
}

export class UpdateDistrictDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(CODE_MAX)
  code?: string;
}
