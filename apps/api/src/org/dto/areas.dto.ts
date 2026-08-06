import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const NAME_MAX = 80;

export class CreateAreaDto {
  @IsString()
  @MinLength(1)
  divisionId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name!: string;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name?: string;

  /** Present to reparent the area under a different division. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  divisionId?: string;
}
