'use client';

import {
  CalendarBlank,
  CalendarPlus,
  Clock,
  Hash,
  PenNib,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, DatePicker, Form, Input, InputNumber, Modal, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';

import type { Meeting } from '@/lib/meetings/meetings';
import { DEFAULT_START_TIME } from '@/lib/meetings/meetings';
import { notPastDateRule, textFieldRules } from '@/lib/validation/rules';
import { useCreateMeetingMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface NewMeetingModalProps {
  open: boolean;
  /** Pre-filled meeting number. Read on every render rather than copied into
   * state at mount, so a still-loading roster — or the number the last create
   * consumed — never leaves the field stale. */
  nextNumber: number;
  onClose: () => void;
  onCreated: (meeting: Meeting) => void;
}

interface FormValues {
  meetingNumber: number;
  date: Dayjs | null;
  time: Dayjs | null;
  theme: string;
}

/** Field wrapper — label, optional hint, and the control itself, matching the
 * rhythm the Start Pathway dialog established. */
function Field({
  htmlFor,
  label,
  Icon,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; weight?: 'bold'; className?: string }>;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink"
      >
        <Icon size={12} weight="bold" className="text-ink-muted" />
        {label}
        {hint ? <span className="font-normal text-ink-muted">· {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

/** Create-meeting dialog behind the header button and the mobile FAB.
 *
 * Deliberately just the slot and the theme: creating a meeting only books it on
 * the roster as a draft. Everything else — roles, speakers, the agenda, and the
 * decision to publish — happens on the meeting's own page, which is where this
 * hands off on success. */
export function NewMeetingModal({ open, nextNumber, onClose, onCreated }: NewMeetingModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createMeeting, { isLoading: isSubmitting }] = useCreateMeetingMutation();
  const { message } = App.useApp();

  /* Cleared from `afterClose` so the reset runs once the dialog has gone rather
   * than flashing an empty form on the way out. */
  function resetForm() {
    form.resetFields();
    setSubmitError(null);
  }

  /* `nextNumber` is derived from the roster and can update between opens (e.g.
   * after a create). `initialValues` is only read once, so mirror the current
   * `nextNumber` into the field whenever the dialog opens. */
  useEffect(() => {
    if (open) form.setFieldsValue({ meetingNumber: nextNumber });
  }, [open, nextNumber, form]);

  async function submit() {
    setSubmitError(null);
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      /* Ant Design renders the per-field errors — nothing else to do here. */
      return;
    }

    try {
      /* Local time, no zone suffix — the same shape the seeded meetings use, so
       * "19:00" stays 19:00 wherever the agenda is opened. */
      const date = (values.date as Dayjs).format('YYYY-MM-DD');
      const time = (values.time as Dayjs).format('HH:mm');
      const created = await createMeeting({
        meetingNumber: values.meetingNumber,
        dateTime: `${date}T${time}:00`,
        theme: values.theme.trim(),
      }).unwrap();

      message.success(`Meeting #${created.meetingNumber} created`);
      onCreated(created);
      onClose();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Could not create the meeting. Please try again.'));
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={resetForm}
      mask={{ closable: !isSubmitting }}
      closable={!isSubmitting}
      title={null}
      centered
      width="min(520px, calc(100vw - 32px))"
      styles={{ body: { padding: 0 } }}
      onOk={() => {
        void submit();
      }}
      confirmLoading={isSubmitting}
      okText="Create meeting"
      cancelText="Cancel"
      okButtonProps={{ size: 'middle' }}
      cancelButtonProps={{ size: 'middle', disabled: isSubmitting }}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        disabled={isSubmitting}
        initialValues={{
          meetingNumber: nextNumber,
          date: null,
          time: dayjs(DEFAULT_START_TIME, 'HH:mm'),
          theme: '',
        }}
      >
        <div className="flex flex-col gap-5">
          <header className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-1">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white"
            >
              <CalendarPlus size={20} weight="bold" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">New meeting</h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                Book the slot and name the theme. The meeting starts as a draft — roles, speakers
                and the agenda are filled in on its own page, and you publish it from there.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-2 px-6 pb-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]">
              <Field htmlFor="meeting-number" label="Number" Icon={Hash}>
                <Form.Item
                  name="meetingNumber"
                  className="!mb-0"
                  rules={[
                    {
                      validator(_, value) {
                        if (value === null || value === undefined || value === '') {
                          return Promise.reject(new Error('Meeting number is required'));
                        }
                        if (!Number.isInteger(value) || value < 1) {
                          return Promise.reject(new Error('Enter a whole number, 1 or higher'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <InputNumber
                    id="meeting-number"
                    size="large"
                    className="w-full"
                    min={1}
                    precision={0}
                  />
                </Form.Item>
              </Field>

              <Field htmlFor="meeting-theme" label="Theme" Icon={PenNib} hint="Required">
                <Form.Item
                  name="theme"
                  className="!mb-0"
                  rules={textFieldRules({ label: 'Theme', max: 80 })}
                >
                  <Input
                    id="meeting-theme"
                    size="large"
                    placeholder="e.g. Cross-Cultural Conversations"
                    maxLength={80}
                  />
                </Form.Item>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field htmlFor="meeting-date" label="Date" Icon={CalendarBlank} hint="Required">
                <Form.Item
                  name="date"
                  className="!mb-0"
                  rules={[
                    { required: true, message: 'Pick a meeting date' },
                    notPastDateRule('Meeting date'),
                  ]}
                >
                  <DatePicker
                    id="meeting-date"
                    size="large"
                    className="w-full"
                    format="D MMM YYYY"
                  />
                </Form.Item>
              </Field>

              <Field htmlFor="meeting-time" label="Start time" Icon={Clock}>
                <Form.Item
                  name="time"
                  className="!mb-0"
                  rules={[{ required: true, message: 'Pick a start time' }]}
                >
                  <TimePicker
                    id="meeting-time"
                    size="large"
                    className="w-full"
                    format="h:mm A"
                    use12Hours
                    minuteStep={5}
                  />
                </Form.Item>
              </Field>
            </div>

            {submitError ? (
              <div
                role="alert"
                className="mt-2 flex items-start gap-2 rounded-xl border border-line-strong bg-fill px-3 py-2.5 text-xs text-ink-soft"
              >
                <WarningCircle size={14} weight="bold" className="mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            ) : null}
          </div>
        </div>
      </Form>
    </Modal>
  );
}
