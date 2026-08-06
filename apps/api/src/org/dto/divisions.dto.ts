import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const NAME_MAX = 80;

export class CreateDivisionDto {
  @IsString()
  @MinLength(1)
  districtId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name!: string;
}

export class UpdateDivisionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name?: string;

  /** Present to reparent the division under a different district. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  districtId?: string;
}
