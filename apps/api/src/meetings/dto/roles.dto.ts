import { IsString, MaxLength, ValidateIf } from 'class-validator';

export const ROLE_KEY_MAX = 64;

/** Body for `PUT /meetings/:meetingId/roles/:roleKey`. `membershipId: null`
 * clears the assignment — the Select's `allowClear` sends the field back
 * empty rather than omitting it, so the field is required, not optional. */
export class SetMeetingRoleDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  membershipId!: string | null;
}
