'use client';

import { App, Input, Modal, Select } from 'antd';
import { useState, useSyncExternalStore } from 'react';
import { SPEECH_SLOT_REQUEST_NOTE_MAX } from '@/lib/education/speech-slot-requests';
import { CURRENT_MEMBER_ID } from '@/lib/me/current-member';
import type { Meeting } from '@/lib/meetings/meetings';
import { useCreateSpeechSlotRequestMutation, useGetMeetingsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/* Same client-clock trick used across the app (see
 * `meeting-checklist-tab.tsx`) so "upcoming" stays deterministic through
 * hydration instead of reading `Date.now()` straight in the render body. */
let cachedClientNow: number | null = null;
function subscribeNever(): () => void {
  return () => {};
}
function readClientNow(): number {
  if (cachedClientNow === null) cachedClientNow = Date.now();
  return cachedClientNow;
}
function readServerNow(): null {
  return null;
}
function useClientNow(): number | null {
  return useSyncExternalStore(subscribeNever, readClientNow, readServerNow);
}

function formatMeetingOption(dateTime: string, theme: string): string {
  const date = new Date(dateTime).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${date} · ${theme}`;
}

interface RequestSpeechSlotModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the project field with whatever the pathway card says is next,
   * since that's the speech a member is most likely asking for a slot for. */
  defaultProjectName?: string;
}

export function RequestSpeechSlotModal({
  open,
  onClose,
  defaultProjectName,
}: RequestSpeechSlotModalProps) {
  const { message } = App.useApp();
  const { data: meetings } = useGetMeetingsQuery();
  const [createRequest, { isLoading }] = useCreateSpeechSlotRequestMutation();
  const now = useClientNow();

  const [meetingId, setMeetingId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState('');
  const [note, setNote] = useState('');

  /* Re-seed the form's defaults whenever the modal transitions closed → open,
   * without an Effect — adjusting state during render on a prop change is the
   * pattern React itself recommends over `useEffect` here. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMeetingId(undefined);
      setProjectName(defaultProjectName ?? '');
      setNote('');
    }
  }

  const upcomingMeetings: Meeting[] =
    now === null
      ? []
      : (meetings ?? [])
          .filter((meeting) => new Date(meeting.dateTime).getTime() >= now)
          .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  function resetAndClose() {
    onClose();
  }

  async function handleSubmit() {
    if (!meetingId) {
      message.error('Pick a meeting to request a slot on');
      return;
    }
    try {
      await createRequest({
        memberId: CURRENT_MEMBER_ID,
        meetingId,
        projectName: projectName.trim() || undefined,
        note: note.trim() || undefined,
      }).unwrap();
      message.success('Request sent to the VPE');
      resetAndClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not send this request'));
    }
  }

  return (
    <Modal
      title="Request a speech slot"
      open={open}
      onCancel={resetAndClose}
      onOk={handleSubmit}
      okText="Send to VPE"
      confirmLoading={isLoading}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2">
        <div>
          <label htmlFor="ssr-meeting" className="mb-1.5 block text-xs font-medium text-ink-soft">
            Meeting
          </label>
          <Select
            id="ssr-meeting"
            className="w-full"
            placeholder="Choose an upcoming meeting"
            value={meetingId}
            onChange={setMeetingId}
            options={upcomingMeetings.map((meeting) => ({
              value: meeting.id,
              label: formatMeetingOption(meeting.dateTime, meeting.theme),
            }))}
            notFoundContent="No upcoming meetings on the roster yet"
          />
        </div>

        <div>
          <label htmlFor="ssr-project" className="mb-1.5 block text-xs font-medium text-ink-soft">
            Project (optional)
          </label>
          <Input
            id="ssr-project"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="e.g. Reflect on Your Path"
          />
        </div>

        <div>
          <label htmlFor="ssr-note" className="mb-1.5 block text-xs font-medium text-ink-soft">
            Note to the VPE (optional)
          </label>
          <Input.TextArea
            id="ssr-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={SPEECH_SLOT_REQUEST_NOTE_MAX}
            rows={3}
            placeholder="Anything they should know when building the agenda"
          />
        </div>
      </div>
    </Modal>
  );
}
