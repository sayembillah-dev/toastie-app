/** Written feedback a member received on a prepared speech. Keyed by the
 * `speech-given` history event it belongs to (see `lib/education/history.ts`)
 * rather than owning its own notion of "which speech" — the event is already
 * the source of truth for the title, meeting and project. */

export interface Evaluation {
  id: string;
  speechEventId: string;
  memberId: string;
  evaluatorId: string;
  meetingNumber: number;
  date: string;
  strengths: string;
  improvement: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
}

export const EVALUATION_SEED: Record<string, Evaluation[]> = {
  'm-01': [
    {
      id: 'eval-m-01-e3',
      speechEventId: 'm-01-e3',
      memberId: 'm-01',
      evaluatorId: 'm-09',
      meetingNumber: 4,
      date: '2024-03-09',
      strengths:
        'Warm, unhurried opening that pulled the room in immediately. Great eye contact across all sections.',
      improvement:
        'A few filler words crept in during the middle section — pause instead of filling the silence.',
      overallRating: 4,
    },
    {
      id: 'eval-m-01-e7',
      speechEventId: 'm-01-e7',
      memberId: 'm-01',
      evaluatorId: 'm-06',
      meetingNumber: 8,
      date: '2024-05-11',
      strengths:
        'Clear structure with a memorable rule of three. The vocal variety on the closing story landed really well.',
      improvement: 'Slow down on the statistics — they went by too fast to land with the audience.',
      overallRating: 4,
    },
    {
      id: 'eval-m-01-e11',
      speechEventId: 'm-01-e11',
      memberId: 'm-01',
      evaluatorId: 'm-02',
      meetingNumber: 15,
      date: '2024-09-14',
      strengths:
        'Best use of the stage yet — purposeful movement that matched the emotional beats of the story.',
      improvement:
        'The transition into the call-to-action felt abrupt; a brief pause would let it breathe.',
      overallRating: 5,
    },
    {
      id: 'eval-m-01-e15',
      speechEventId: 'm-01-e15',
      memberId: 'm-01',
      evaluatorId: 'm-13',
      meetingNumber: 21,
      date: '2025-04-05',
      strengths:
        'Handled the hostile-audience scenario with real composure — the redirect technique was textbook.',
      improvement: 'Keep the humour earlier in the speech too, not just saved for the ending.',
      overallRating: 4,
    },
    /* m-01-e19, the most recent speech, has no evaluation yet — the evaluator
     * has a week to submit it, which the Me page should show as pending. */
  ],
};
