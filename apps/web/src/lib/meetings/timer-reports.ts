/** One row per prepared speech, filed by the meeting's Timer. Keyed by the
 * `speech-given` history event the same way `Evaluation` is — see
 * `lib/education/evaluations.ts` for why. */

export interface TimerEntry {
  id: string;
  speechEventId: string;
  memberId: string;
  meetingNumber: number;
  date: string;
  targetMinMinutes: number;
  targetMaxMinutes: number;
  actualSeconds: number;
}

export type TimerVerdict = 'under' | 'within' | 'over';

export function deriveTimerVerdict(
  entry: Pick<TimerEntry, 'targetMinMinutes' | 'targetMaxMinutes' | 'actualSeconds'>,
): TimerVerdict {
  const actualMinutes = entry.actualSeconds / 60;
  if (actualMinutes < entry.targetMinMinutes) return 'under';
  if (actualMinutes > entry.targetMaxMinutes) return 'over';
  return 'within';
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const TIMER_ENTRY_SEED: Record<string, TimerEntry[]> = {
  'm-01': [
    {
      id: 'timer-m-01-e3',
      speechEventId: 'm-01-e3',
      memberId: 'm-01',
      meetingNumber: 4,
      date: '2024-03-09',
      targetMinMinutes: 4,
      targetMaxMinutes: 6,
      actualSeconds: 5 * 60 + 42,
    },
    {
      id: 'timer-m-01-e7',
      speechEventId: 'm-01-e7',
      memberId: 'm-01',
      meetingNumber: 8,
      date: '2024-05-11',
      targetMinMinutes: 5,
      targetMaxMinutes: 7,
      actualSeconds: 7 * 60 + 20,
    },
    {
      id: 'timer-m-01-e11',
      speechEventId: 'm-01-e11',
      memberId: 'm-01',
      meetingNumber: 15,
      date: '2024-09-14',
      targetMinMinutes: 5,
      targetMaxMinutes: 7,
      actualSeconds: 6 * 60 + 10,
    },
    {
      id: 'timer-m-01-e15',
      speechEventId: 'm-01-e15',
      memberId: 'm-01',
      meetingNumber: 21,
      date: '2025-04-05',
      targetMinMinutes: 5,
      targetMaxMinutes: 7,
      actualSeconds: 4 * 60 + 50,
    },
    /* m-01-e19 has no timer report yet — same pending state as its evaluation. */
  ],
};
