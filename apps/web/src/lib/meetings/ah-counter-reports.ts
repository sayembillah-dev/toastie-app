/** One row per prepared speech, filed by the meeting's Ah-Counter. Keyed by
 * the `speech-given` history event, same convention as `TimerEntry` and
 * `Evaluation`. */

export interface AhCounterEntry {
  id: string;
  speechEventId: string;
  memberId: string;
  meetingNumber: number;
  date: string;
  fillerCounts: Record<string, number>;
}

export function totalFillers(entry: Pick<AhCounterEntry, 'fillerCounts'>): number {
  return Object.values(entry.fillerCounts).reduce((sum, count) => sum + count, 0);
}

export const AH_COUNTER_ENTRY_SEED: Record<string, AhCounterEntry[]> = {
  'm-01': [
    {
      id: 'ah-m-01-e3',
      speechEventId: 'm-01-e3',
      memberId: 'm-01',
      meetingNumber: 4,
      date: '2024-03-09',
      fillerCounts: { ah: 4, um: 2, so: 1, like: 0 },
    },
    {
      id: 'ah-m-01-e7',
      speechEventId: 'm-01-e7',
      memberId: 'm-01',
      meetingNumber: 8,
      date: '2024-05-11',
      fillerCounts: { ah: 2, um: 1, so: 2, like: 1 },
    },
    {
      id: 'ah-m-01-e11',
      speechEventId: 'm-01-e11',
      memberId: 'm-01',
      meetingNumber: 15,
      date: '2024-09-14',
      fillerCounts: { ah: 1, um: 0, so: 1, like: 0 },
    },
    {
      id: 'ah-m-01-e15',
      speechEventId: 'm-01-e15',
      memberId: 'm-01',
      meetingNumber: 21,
      date: '2025-04-05',
      fillerCounts: { ah: 0, um: 1, so: 0, like: 0 },
    },
    /* m-01-e19 has no ah-counter report yet — same pending state as the other two reports. */
  ],
};
