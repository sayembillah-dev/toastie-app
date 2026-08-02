'use client';

import {
  CalendarBlank,
  CalendarPlus,
  Clock,
  Hash,
  PenNib,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Input, InputNumber, Modal } from 'antd';
import { useState } from 'react';

import type { Meeting } from '@/lib/meetings/meetings';
import { DEFAULT_START_TIME } from '@/lib/meetings/meetings';
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

interface FormState {
  /** `null` means "untouched" — the field shows `nextNumber` until the user
   * overrides it. */
  meetingNumber: number | null;
  date: string;
  time: string;
  theme: string;
}

const INITIAL_STATE: FormState = {
  meetingNumber: null,
  date: '',
  time: DEFAULT_START_TIME,
  theme: '',
};

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
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createMeeting, { isLoading: isSubmitting }] = useCreateMeetingMutation();
  const { message } = App.useApp();

  const meetingNumber = form.meetingNumber ?? nextNumber;
  const canSubmit = form.date !== '' && form.time !== '' && form.theme.trim() !== '';

  /* Cleared from `afterClose` so the reset runs once the dialog has gone rather
   * than flashing an empty form on the way out. */
  function resetForm() {
    setForm(INITIAL_STATE);
    setSubmitError(null);
  }

  function patch(next: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  async function submit() {
    if (!canSubmit || isSubmitting) return;
    setSubmitError(null);

    try {
      /* Local time, no zone suffix — the same shape the seeded meetings use, so
       * "19:00" stays 19:00 wherever the agenda is opened. */
      const created = await createMeeting({
        meetingNumber,
        dateTime: `${form.date}T${form.time}:00`,
        theme: form.theme.trim(),
      }).unwrap();

      message.success(`Meeting #${created.meetingNumber} created`);
      onCreated(created);
      onClose();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Could not create the meeting'));
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
      okButtonProps={{ disabled: !canSubmit, size: 'middle' }}
      cancelButtonProps={{ size: 'middle', disabled: isSubmitting }}
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
              Book the slot and name the theme. The meeting starts as a draft — roles, speakers and
              the agenda are filled in on its own page, and you publish it from there.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-4 px-6 pb-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]">
            <Field htmlFor="meeting-number" label="Number" Icon={Hash}>
              <InputNumber
                id="meeting-number"
                size="large"
                className="w-full"
                min={1}
                precision={0}
                value={meetingNumber}
                onChange={(value) => patch({ meetingNumber: value ?? null })}
              />
            </Field>

            <Field htmlFor="meeting-theme" label="Theme" Icon={PenNib} hint="Required">
              <Input
                id="meeting-theme"
                size="large"
                placeholder="e.g. Cross-Cultural Conversations"
                value={form.theme}
                onChange={(event) => patch({ theme: event.target.value })}
                maxLength={80}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field htmlFor="meeting-date" label="Date" Icon={CalendarBlank} hint="Required">
              {/* Native date/time controls rather than antd's pickers: they give
               * phones the OS wheel and keep antd's dayjs build out of the
               * bundle, while `Input` keeps the field visually in family. */}
              <Input
                id="meeting-date"
                size="large"
                type="date"
                value={form.date}
                onChange={(event) => patch({ date: event.target.value })}
              />
            </Field>

            <Field htmlFor="meeting-time" label="Start time" Icon={Clock}>
              <Input
                id="meeting-time"
                size="large"
                type="time"
                value={form.time}
                onChange={(event) => patch({ time: event.target.value })}
              />
            </Field>
          </div>

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-line-strong bg-fill px-3 py-2.5 text-xs text-ink-soft"
            >
              <WarningCircle size={14} weight="bold" className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
