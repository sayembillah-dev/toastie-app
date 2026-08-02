'use client';

import { CheckCircle, PaperPlaneTilt, PenNib } from '@phosphor-icons/react/dist/ssr';
import { App, Button } from 'antd';
import { useState } from 'react';

import type { Meeting, MeetingStatus } from '@/lib/meetings/meetings';
import { useUpdateMeetingMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import { selectMeetingDraft } from '@/store/meeting-draft-slice';

interface MeetingActionsProps {
  meeting: Meeting;
}

/**
 * The meeting's commit bar, sitting above the tabs so it is reachable from
 * whichever one you happen to be on.
 *
 * "Save as Draft" keeps the meeting off the club view while the run of show is
 * still being assembled; "Publish" makes it the version the club sees. Both are
 * the same write with a different status, and both carry the Theme tab's
 * working theme back onto the meeting record — that is the one piece of the
 * draft the record itself owns, and it is what the roster card shows.
 */
export function MeetingActions({ meeting }: MeetingActionsProps) {
  const draft = useAppSelector((state) => selectMeetingDraft(state, meeting.id));
  /* Which button is mid-flight — both share one mutation, so a single
   * `isLoading` could not say which spinner to show. */
  const [pending, setPending] = useState<MeetingStatus | null>(null);
  const [updateMeeting] = useUpdateMeetingMutation();
  const { message } = App.useApp();

  const isPublished = meeting.status === 'published';
  const workingTheme = draft.theme.trim();
  const hasThemeEdit = workingTheme !== '' && workingTheme !== meeting.theme;

  async function commit(status: MeetingStatus) {
    if (pending !== null) return;
    setPending(status);

    try {
      const saved = await updateMeeting({
        meetingId: meeting.id,
        status,
        /* Omitted unless the Theme tab actually changed it — the API leaves an
         * absent theme alone rather than writing back what it already holds. */
        ...(hasThemeEdit ? { theme: workingTheme } : {}),
      }).unwrap();

      message.success(
        status === 'published'
          ? `Meeting #${saved.meetingNumber} is published`
          : `Meeting #${saved.meetingNumber} saved as a draft`,
      );
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not save the meeting'));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="print-hidden mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span
          aria-hidden
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
            isPublished ? 'bg-ink text-white' : 'bg-fill text-ink-soft'
          }`}
        >
          {isPublished ? (
            <CheckCircle size={14} weight="bold" />
          ) : (
            <PenNib size={14} weight="bold" />
          )}
        </span>
        <span className="min-w-0">
          <span className="font-semibold text-ink">{isPublished ? 'Published' : 'Draft'}</span>
          <span className="text-ink-muted">
            {isPublished
              ? ' · the club sees this agenda'
              : ' · only the committee sees this until you publish'}
          </span>
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          size="middle"
          icon={<PenNib size={14} weight="bold" />}
          disabled={pending === 'published'}
          loading={pending === 'draft'}
          onClick={() => {
            void commit('draft');
          }}
        >
          Save as Draft
        </Button>
        <Button
          type="primary"
          size="middle"
          icon={<PaperPlaneTilt size={14} weight="bold" />}
          disabled={pending === 'draft'}
          loading={pending === 'published'}
          onClick={() => {
            void commit('published');
          }}
        >
          Publish
        </Button>
      </div>
    </div>
  );
}
