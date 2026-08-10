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

/** Attendance guests always resolve to an existing `Prospect` — `/people` is
 * the only place a guest gets created, so checking someone in at a meeting
 * links to one rather than typing a fresh name. */
export class CreateGuestAttendanceDto {
  @IsString()
  @MinLength(1)
  guestId!: string;
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
