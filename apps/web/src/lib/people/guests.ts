export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** ISO date (YYYY-MM-DD) of their first visit to the club. */
  firstVisit: string;
  /** ISO date (YYYY-MM-DD) of the most recent visit; equal to firstVisit on day one. */
  lastVisit: string;
  /** Total number of meetings attended so far. */
  visitCount: number;
  /** Free-text name of the member or contact who brought them along. */
  invitedBy?: string;
}

export const SEED_GUESTS: Guest[] = [
  {
    id: 'g-01',
    firstName: 'Elena',
    lastName: 'Vasquez',
    email: 'elena.vasquez@example.com',
    firstVisit: '2026-07-08',
    lastVisit: '2026-07-22',
    visitCount: 2,
    invitedBy: 'Aisha Patel',
  },
  {
    id: 'g-02',
    firstName: 'Jamal',
    lastName: 'Osei',
    email: 'jamal.osei@example.com',
    firstVisit: '2026-07-22',
    lastVisit: '2026-07-22',
    visitCount: 1,
    invitedBy: 'Marcus Chen',
  },
  {
    id: 'g-03',
    firstName: 'Mei',
    lastName: 'Tanaka',
    firstVisit: '2026-06-24',
    lastVisit: '2026-07-22',
    visitCount: 3,
    invitedBy: 'Priya Sharma',
  },
  {
    id: 'g-04',
    firstName: 'Lucas',
    lastName: 'Fernandez',
    email: 'lucas.f@example.com',
    firstVisit: '2026-07-15',
    lastVisit: '2026-07-15',
    visitCount: 1,
  },
  {
    id: 'g-05',
    firstName: 'Ada',
    lastName: 'Onyekachi',
    email: 'ada.o@example.com',
    firstVisit: '2026-05-13',
    lastVisit: '2026-07-08',
    visitCount: 4,
    invitedBy: 'Grace Okafor',
  },
  {
    id: 'g-06',
    firstName: 'Henrik',
    lastName: 'Sørensen',
    firstVisit: '2026-07-01',
    lastVisit: '2026-07-15',
    visitCount: 2,
    invitedBy: 'Nathan Brooks',
  },
];

export function getGuestInitials(guest: Pick<Guest, 'firstName' | 'lastName'>): string {
  return `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`.toUpperCase();
}
