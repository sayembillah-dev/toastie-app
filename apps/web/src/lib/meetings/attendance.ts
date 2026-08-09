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
  name: string;
  present: boolean;
}

export interface CreateGuestAttendanceInput {
  name: string;
}

export interface UpdateGuestAttendanceInput {
  name?: string;
  present?: boolean;
}

export interface MarkAllAttendanceResult {
  members: MemberAttendance[];
  guests: GuestAttendance[];
}
