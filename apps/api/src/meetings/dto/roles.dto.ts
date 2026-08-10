import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export const ROLE_KEY_MAX = 64;

/** Body for `PUT /meetings/:meetingId/roles/:roleKey`. `membershipId: null`
 * clears the assignment — the Select's `allowClear` sends the field back
 * empty rather than omitting it, so the field is required, not optional.
 * `guestId` is the same idea for a guest holding the role instead of a
 * member — at most one of the two is ever set, enforced in the service. */
export class SetMeetingRoleDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  membershipId!: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  guestId?: string | null;
}
