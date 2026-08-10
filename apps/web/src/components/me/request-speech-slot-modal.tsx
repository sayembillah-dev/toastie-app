'use client';

import { App, Form, Input, Modal, Select } from 'antd';
import { useEffect, useSyncExternalStore } from 'react';
import { SPEECH_SLOT_REQUEST_NOTE_MAX } from '@/lib/education/speech-slot-requests';
import type { Meeting } from '@/lib/meetings/meetings';
import { requiredSelectRule } from '@/lib/validation/rules';
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
  memberId: string;
  open: boolean;
  onClose: () => void;
  /** Pre-fills the project field with whatever the pathway card says is next,
   * since that's the speech a member is most likely asking for a slot for. */
  defaultProjectName?: string;
}

interface FormValues {
  meetingId?: string;
  projectName: string;
  note: string;
}

export function RequestSpeechSlotModal({
  memberId,
  open,
  onClose,
  defaultProjectName,
}: RequestSpeechSlotModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const { data: meetings } = useGetMeetingsQuery();
  const [createRequest, { isLoading }] = useCreateSpeechSlotRequestMutation();
  const now = useClientNow();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        meetingId: undefined,
        projectName: defaultProjectName ?? '',
        note: '',
      });
    }
  }, [open, form, defaultProjectName]);

  const upcomingMeetings: Meeting[] =
    now === null
      ? []
      : (meetings ?? [])
          .filter((meeting) => new Date(meeting.dateTime).getTime() >= now)
          .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  async function handleSubmit() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await createRequest({
        memberId,
        meetingId: values.meetingId as string,
        projectName: values.projectName.trim() || undefined,
        note: values.note.trim() || undefined,
      }).unwrap();
      message.success('Request sent to the VPE');
      onClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't send this request. Please try again."));
    }
  }

  return (
    <Modal
      title="Request a speech slot"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Send to VPE"
      confirmLoading={isLoading}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        disabled={isLoading}
        initialValues={{ meetingId: undefined, projectName: defaultProjectName ?? '', note: '' }}
        className="flex flex-col gap-4 pt-2"
      >
        <Form.Item
          label="Meeting"
          name="meetingId"
          rules={[requiredSelectRule('Meeting')]}
          className="!mb-0"
        >
          <Select
            id="ssr-meeting"
            className="w-full"
            placeholder="Choose an upcoming meeting"
            options={upcomingMeetings.map((meeting) => ({
              value: meeting.id,
              label: formatMeetingOption(meeting.dateTime, meeting.theme),
            }))}
            notFoundContent="No upcoming meetings on the roster yet"
          />
        </Form.Item>

        <Form.Item
          label="Project (optional)"
          name="projectName"
          rules={[{ max: 120, message: 'Keep it under 120 characters' }]}
          className="!mb-0"
        >
          <Input id="ssr-project" placeholder="e.g. Reflect on Your Path" />
        </Form.Item>

        <Form.Item
          label="Note to the VPE (optional)"
          name="note"
          rules={[
            {
              max: SPEECH_SLOT_REQUEST_NOTE_MAX,
              message: `Keep it under ${SPEECH_SLOT_REQUEST_NOTE_MAX} characters`,
            },
          ]}
          className="!mb-0"
        >
          <Input.TextArea
            id="ssr-note"
            maxLength={SPEECH_SLOT_REQUEST_NOTE_MAX}
            rows={3}
            placeholder="Anything they should know when building the agenda"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
