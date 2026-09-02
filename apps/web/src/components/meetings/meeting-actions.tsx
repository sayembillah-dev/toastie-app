'use client';

import {
  CheckCircle,
  Link as LinkIcon,
  PaperPlaneTilt,
  PenNib,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ReadOnly } from '@/components/permissions/read-only';
import type { Meeting, MeetingStatus } from '@/lib/meetings/meetings';
import { useDeleteMeetingMutation, useUpdateMeetingMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppSelector } from '@/store/hooks';
import { selectMeetingDraft } from '@/store/meeting-draft-slice';

interface MeetingActionsProps {
  meeting: Meeting;
}

/** Everything the meeting's commit actions do — status writes that carry the
 * Theme tab's working theme/word along, the public agenda link, and delete —
 * extracted so the desktop commit bar and the mobile action strip share one
 * implementation and can never drift on behavior.
 *
 * "Save as Draft" keeps the meeting off the club view while the run of show is
 * still being assembled; "Publish" makes it the version the club sees. Both are
 * the same write with a different status, and both carry the Theme tab's
 * working theme back onto the meeting record — that is the one piece of the
 * draft the record itself owns, and it is what the roster card shows.
 */
export function useMeetingActions(meeting: Meeting) {
  const draft = useAppSelector((state) => selectMeetingDraft(state, meeting.id));
  /* Which button is mid-flight — both share one mutation, so a single
   * `isLoading` could not say which spinner to show. */
  const [pending, setPending] = useState<MeetingStatus | null>(null);
  const [updateMeeting] = useUpdateMeetingMutation();
  const [deleteMeeting, { isLoading: isDeleting }] = useDeleteMeetingMutation();
  const { message, modal } = App.useApp();
  const router = useRouter();

  const isPublished = meeting.status === 'published';
  const workingTheme = draft.theme.trim();
  const hasThemeEdit = workingTheme !== '' && workingTheme !== meeting.theme;
  /* The Theme tab has its own Save, but committing from here should not
   * silently drop what is sitting in the tab unsaved — carry any word edit
   * along with the status write. */
  const savedWord = meeting.word;
  const hasWordEdit =
    draft.word.word.trim() !== (savedWord?.word ?? '') ||
    (draft.word.partOfSpeech ?? '') !== (savedWord?.partOfSpeech ?? '') ||
    draft.word.meaning.trim() !== (savedWord?.meaning ?? '') ||
    draft.word.example.trim() !== (savedWord?.example ?? '');

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
        ...(hasWordEdit
          ? {
              word: {
                word: draft.word.word.trim(),
                partOfSpeech: draft.word.partOfSpeech ?? '',
                meaning: draft.word.meaning.trim(),
                example: draft.word.example.trim(),
              },
            }
          : {}),
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

  /* No share token on this link — once published, the agenda is meant for
   * anyone with the meeting id, the same way the club roster page itself
   * has no token. */
  async function copyAgendaLink() {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const url = `${origin}/meetings/${meeting.id}/agenda`;
    try {
      await navigator.clipboard.writeText(url);
      message.success('Public agenda link copied');
    } catch {
      message.error('Could not copy link');
    }
  }

  /* Runs the delete inside the confirm modal's `onOk`, same as guest delete —
   * keeps the dialog open with its own spinner and only navigates away once
   * the record is actually gone. */
  const confirmDelete = () => {
    modal.confirm({
      title: `Delete meeting #${meeting.meetingNumber}?`,
      icon: <WarningCircle size={20} weight="fill" className="text-rose-600" />,
      content: (
        <p className="text-sm text-ink-soft">
          This removes the meeting along with its roles, prepared speakers, table topics, and
          attendance records. This action cannot be undone.
        </p>
      ),
      okText: 'Delete meeting',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteMeeting(meeting.id).unwrap();
          message.success(`Meeting #${meeting.meetingNumber} was deleted`);
          router.push('/meetings');
        } catch (err) {
          message.error(getApiErrorMessage(err, 'Could not delete the meeting'));
          throw err;
        }
      },
    });
  };

  return { isPublished, pending, isDeleting, commit, copyAgendaLink, confirmDelete };
}

/** The meeting's commit bar, sitting above the tabs so it is reachable from
 * whichever one you happen to be on. Desktop-only — phones mount
 * `MeetingActionsMobile` instead; both speak through `useMeetingActions`. */
export function MeetingActions({ meeting }: MeetingActionsProps) {
  const { isPublished, pending, isDeleting, commit, copyAgendaLink, confirmDelete } =
    useMeetingActions(meeting);

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
        <ReadOnly resource="meeting" className="gap-2">
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
        </ReadOnly>
        {isPublished && (
          <Button
            size="middle"
            icon={<LinkIcon size={14} weight="bold" />}
            onClick={() => {
              void copyAgendaLink();
            }}
          >
            Copy public agenda link
          </Button>
        )}
        <ReadOnly resource="meeting" action="delete">
          <div className="ml-1 flex items-center gap-2 border-l border-line pl-3">
            <Button
              danger
              type="text"
              size="middle"
              icon={<Trash size={14} weight="bold" />}
              loading={isDeleting}
              onClick={confirmDelete}
              aria-label="Delete meeting"
            >
              Delete
            </Button>
          </div>
        </ReadOnly>
      </div>
    </div>
  );
}
