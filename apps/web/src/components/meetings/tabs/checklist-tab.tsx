'use client';

import { MeetingChecklist } from '@/components/checklist/meeting-checklist';

interface ChecklistTabProps {
  meetingId: string;
}

/** Checklist tab — the pre-meeting setup list. The rows live in the shared
 * checklist store so the Inventory > Meeting checklist surface mirrors what
 * happens here (and vice versa). */
export function ChecklistTab({ meetingId }: ChecklistTabProps) {
  return <MeetingChecklist meetingId={meetingId} />;
}
