import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const GUEST_NAME_MAX = 80;

export class SetMemberAttendanceDto {
  @IsBoolean()
  present!: boolean;
}

export class MarkAllAttendanceDto {
  @IsBoolean()
  present!: boolean;
}

export class CreateGuestAttendanceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(GUEST_NAME_MAX)
  name!: string;
}

export class UpdateGuestAttendanceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(GUEST_NAME_MAX)
  name?: string;

  @IsOptional()
  @IsBoolean()
  present?: boolean;
}
