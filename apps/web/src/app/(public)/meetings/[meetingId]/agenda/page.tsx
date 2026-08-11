'use client';

import { useParams } from 'next/navigation';

import { PublicAgendaPage } from '@/components/meetings/public-agenda-page';

export default function MeetingAgendaPublicPage() {
  const params = useParams<{ meetingId: string }>();
  const meetingId = params?.meetingId ?? '';

  return <PublicAgendaPage meetingId={meetingId} />;
}
