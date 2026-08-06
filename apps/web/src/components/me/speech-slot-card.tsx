'use client';

import { CalendarPlus, Plus } from '@phosphor-icons/react/dist/ssr';
import { Button, Skeleton, Tag } from 'antd';

import {
  SPEECH_SLOT_REQUEST_STATUS_LABELS,
  type SpeechSlotRequestStatus,
} from '@/lib/education/speech-slot-requests';
import { useGetMeetingsQuery, useGetSpeechSlotRequestsQuery } from '@/store/api';

const STATUS_TAG_COLOR: Record<SpeechSlotRequestStatus, string> = {
  pending: 'gold',
  approved: 'success',
  declined: 'error',
};

function formatMeetingDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface SpeechSlotCardProps {
  memberId: string;
  onNewRequest: () => void;
}

/** History of asks sent to the VPE for a speaking slot — the member-facing
 * half of agenda building. Approving/declining happens on the VPE's side,
 * which isn't part of this page. */
export function SpeechSlotCard({ memberId, onNewRequest }: SpeechSlotCardProps) {
  const { data: requests, isLoading } = useGetSpeechSlotRequestsQuery(memberId);
  const { data: meetings } = useGetMeetingsQuery();
  const meetingById = new Map((meetings ?? []).map((meeting) => [meeting.id, meeting]));

  return (
    <article className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarPlus size={15} weight="bold" className="text-ink-muted" />
          Speech slot requests
        </h2>
        <Button size="small" icon={<Plus size={13} weight="bold" />} onClick={onNewRequest}>
          New
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-3">
          <Skeleton active title={false} paragraph={{ rows: 2 }} />
        </div>
      ) : null}

      {!isLoading && requests && requests.length === 0 ? (
        <p className="mt-3 text-xs text-ink-muted">
          No requests yet — ask the VPE for your next slot whenever you&rsquo;re ready.
        </p>
      ) : null}

      {!isLoading && requests && requests.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {requests.map((request) => {
            const meeting = meetingById.get(request.meetingId);
            return (
              <li key={request.id} className="rounded-lg bg-fill/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {meeting ? meeting.theme : request.meetingId}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {meeting ? formatMeetingDate(meeting.dateTime) : ''}
                      {request.projectName ? ` · ${request.projectName}` : ''}
                    </p>
                  </div>
                  <Tag color={STATUS_TAG_COLOR[request.status]} className="shrink-0">
                    {SPEECH_SLOT_REQUEST_STATUS_LABELS[request.status]}
                  </Tag>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
