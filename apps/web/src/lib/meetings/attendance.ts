/** Attendance for one meeting: club-roster check-in plus ad-hoc guest rows.
 * A `MemberAttendance` row only exists once its member has been toggled at
 * least once — an absent row reads as "not present". */

export const GUEST_NAME_MAX = 80;

export interface MemberAttendance {
  membershipId: string;
  present: boolean;
}

export interface GuestAttendance {
  id: string;
  /** The `Prospect` (guest-pipeline) record this row is linked to. Only
   * absent on rows created before this link existed. */
  guestId?: string;
  name: string;
  present: boolean;
}

/** Meeting-day guests always resolve to an existing `Guest` — `/people` is
 * the only place one gets created. */
export interface CreateGuestAttendanceInput {
  guestId: string;
}

export interface UpdateGuestAttendanceInput {
  name?: string;
  present?: boolean;
}

export interface MarkAllAttendanceResult {
  members: MemberAttendance[];
  guests: GuestAttendance[];
}
