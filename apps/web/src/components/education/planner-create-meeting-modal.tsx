'use client';

import {
  CalendarBlank,
  CalendarPlus,
  Clock,
  Hash,
  Info,
  Palette,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Input, InputNumber, Modal } from 'antd';
import { useState } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import type { Member } from '@/lib/education/members';
import type { Assignee, AssigneeField, PlannerRow } from '@/lib/education/planner';
import { toAssigneesJson } from '@/lib/education/planner';
import { buildMeetingSeed, countGuestAssignees } from '@/lib/meetings/from-planner';
import type { Meeting } from '@/lib/meetings/meetings';
import { DEFAULT_START_TIME } from '@/lib/meetings/meetings';
import {
  useCreateMeetingMutation,
  useSetMeetingRoleMutation,
  useUpdatePlannerRowMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';
import { draftSeeded } from '@/store/meeting-draft-slice';

interface PlannerCreateMeetingModalProps {
  open: boolean;
  /** The row being turned into a meeting. The parent holds it until
   * `onClosed` so the body stays rendered through the exit animation. */
  row: PlannerRow | null;
  members: Member[];
  onClose: () => void;
  /** Fired once the dialog has finished animating away. */
  onClosed: () => void;
}

interface RoleField {
  field: AssigneeField;
  label: string;
}

/* The row's thirteen slots, grouped the way the agenda reads rather than the
 * way the grid scrolls — this is the last look before the meeting exists. */
const ROLE_GROUPS: Array<{ title: string; fields: RoleField[] }> = [
  {
    title: 'Hosting',
    fields: [
      { field: 'tmod', label: 'Toastmaster' },
      { field: 'generalEvaluator', label: 'General Evaluator' },
    ],
  },
  {
    title: 'Table Topics',
    fields: [
      { field: 'ttm', label: 'Table Topics Master' },
      { field: 'ttEvaluator', label: 'TT Evaluator' },
    ],
  },
  {
    title: 'Prepared speakers',
    fields: [
      { field: 'speaker1', label: 'Speaker 1' },
      { field: 'evaluator1', label: 'Evaluator 1' },
      { field: 'speaker2', label: 'Speaker 2' },
      { field: 'evaluator2', label: 'Evaluator 2' },
      { field: 'speaker3', label: 'Speaker 3' },
      { field: 'evaluator3', label: 'Evaluator 3' },
    ],
  },
  {
    title: 'Support team',
    fields: [
      { field: 'timer', label: 'Timer' },
      { field: 'ahCounter', label: 'Ah-counter' },
      { field: 'grammarian', label: 'Grammarian' },
    ],
  },
];

const ALL_ROLE_FIELDS: RoleField[] = ROLE_GROUPS.flatMap((group) => group.fields);

/** `datetime-local` values are "YYYY-MM-DDTHH:mm", so the two halves are a
 * slice apart. Time falls back to the club's usual slot rather than midnight. */
function splitDateTime(dateTime: string | null): { date: string; time: string } {
  if (!dateTime) return { date: '', time: DEFAULT_START_TIME };
  return { date: dateTime.slice(0, 10), time: dateTime.slice(11, 16) || DEFAULT_START_TIME };
}

function joinDateTime(date: string, time: string): string | null {
  return date ? `${date}T${time || DEFAULT_START_TIME}` : null;
}

function Labelled({
  htmlFor,
  label,
  Icon,
  children,
}: {
  htmlFor: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; weight?: 'bold'; className?: string }>;
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
      </label>
      {children}
    </div>
  );
}

/**
 * The confirm step between a planner row and a real meeting: everything the row
 * holds, laid out at a glance and still editable, because the planner grid is
 * wide enough that a missed slot is easy to scroll past.
 *
 * Creating leaves the meeting as a draft on the Meetings page, writes the
 * planner's role picks straight to the meeting's own role assignments, links
 * the row to the new meeting (the grid's green-shading join), and saves back
 * anything edited in this dialog.
 */
export function PlannerCreateMeetingModal({
  open,
  row,
  members,
  onClose,
  onClosed,
}: PlannerCreateMeetingModalProps) {
  /* `null` means "untouched" — the row itself is the value until the user
   * changes something, so a reopened dialog always shows current row data
   * without an effect to sync it. */
  const [edits, setEdits] = useState<PlannerRow | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createMeeting, { isLoading: isSubmitting }] = useCreateMeetingMutation();
  const [setMeetingRole] = useSetMeetingRoleMutation();
  const [updatePlannerRow] = useUpdatePlannerRowMutation();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();

  const form = edits ?? row;
  const { date, time } = splitDateTime(form?.dateTime ?? null);

  const theme = form?.theme.trim() ?? '';
  const canSubmit = form !== null && form.meetingNumber !== null && date !== '' && theme !== '';

  const guestCount = form ? countGuestAssignees(form) : 0;
  const unassignedCount = form
    ? ALL_ROLE_FIELDS.filter((role) => (form[role.field] as Assignee | null) === null).length
    : 0;

  function handleClosed() {
    setEdits(null);
    setSubmitError(null);
    onClosed();
  }

  function patch(next: Partial<PlannerRow>) {
    if (!form) return;
    setEdits({ ...form, ...next });
  }

  async function submit() {
    if (!form || !canSubmit || isSubmitting) return;
    setSubmitError(null);

    const meetingNumber = form.meetingNumber as number;
    let created: Meeting;
    try {
      created = await createMeeting({
        meetingNumber,
        /* Seconds appended to match the shape the meeting record stores. */
        dateTime: `${date}T${time}:00`,
        theme,
      }).unwrap();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Could not create the meeting'));
      return;
    }

    message.success(`Meeting #${created.meetingNumber} created as a draft`);

    /* Everything past this point is best-effort follow-up — the meeting
     * itself already exists, so a hiccup here surfaces as a toast rather
     * than blocking the dialog on a meeting that was, in fact, created. */
    try {
      const seed = buildMeetingSeed(form);
      await Promise.all(
        Object.entries(seed.roles).map(([roleKey, memberId]) =>
          setMeetingRole({ meetingId: created.id, roleKey, membershipId: memberId }).unwrap(),
        ),
      );
      /* Speaker pairs still seed into the client-only draft — Prepared
       * Speakers has no backend of its own yet. */
      dispatch(draftSeeded(created.id, seed));

      await updatePlannerRow({
        rowId: form.id,
        meetingId: created.id,
        meetingNumber: form.meetingNumber,
        dateTime: form.dateTime,
        theme: form.theme,
        notes: form.notes,
        assignees: toAssigneesJson(form),
      }).unwrap();
    } catch (error) {
      message.warning(
        getApiErrorMessage(
          error,
          'Meeting created, but some details did not carry over — check the Roles tab',
        ),
      );
    }

    onClose();
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={handleClosed}
      onOk={() => {
        void submit();
      }}
      confirmLoading={isSubmitting}
      mask={{ closable: !isSubmitting }}
      closable={!isSubmitting}
      okText="Create meeting"
      cancelText="Cancel"
      okButtonProps={{ disabled: !canSubmit, size: 'middle' }}
      cancelButtonProps={{ size: 'middle', disabled: isSubmitting }}
      title={null}
      centered
      width="min(720px, calc(100vw - 32px))"
      styles={{ body: { padding: 0, maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' } }}
    >
      {form ? (
        <div className="flex flex-col gap-5">
          <header className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-1">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white"
            >
              <CalendarPlus size={20} weight="bold" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">Create meeting from planner</h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                One last look at the row. Anything you change here is saved back to the planner as
                well, and the meeting is created as a draft you can publish later.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-5 px-6 pb-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr_1fr]">
              <Labelled htmlFor="planner-create-number" label="Meeting no." Icon={Hash}>
                <InputNumber
                  id="planner-create-number"
                  size="large"
                  className="w-full"
                  min={1}
                  precision={0}
                  placeholder="e.g. 56"
                  value={form.meetingNumber}
                  onChange={(value) => patch({ meetingNumber: value ?? null })}
                />
              </Labelled>

              <Labelled htmlFor="planner-create-date" label="Date" Icon={CalendarBlank}>
                <Input
                  id="planner-create-date"
                  size="large"
                  type="date"
                  value={date}
                  onChange={(event) => patch({ dateTime: joinDateTime(event.target.value, time) })}
                />
              </Labelled>

              <Labelled htmlFor="planner-create-time" label="Start time" Icon={Clock}>
                <Input
                  id="planner-create-time"
                  size="large"
                  type="time"
                  value={time}
                  onChange={(event) => patch({ dateTime: joinDateTime(date, event.target.value) })}
                />
              </Labelled>
            </div>

            <Labelled htmlFor="planner-create-theme" label="Theme" Icon={Palette}>
              <Input
                id="planner-create-theme"
                size="large"
                placeholder="e.g. Cross-Cultural Conversations"
                value={form.theme}
                onChange={(event) => patch({ theme: event.target.value })}
                maxLength={80}
              />
            </Labelled>

            <div className="flex flex-col gap-3">
              {ROLE_GROUPS.map((group) => (
                <section key={group.title} className="rounded-xl border border-line bg-sidebar p-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.fields.map((role) => (
                      <div key={role.field} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 text-xs text-ink-soft">{role.label}</span>
                        {/* Same control as the grid, boxed so it reads as a
                         * field rather than a bare label in the dialog. */}
                        <div className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-1">
                          <AssigneeSelect
                            value={form[role.field] as Assignee | null}
                            onChange={(next) =>
                              patch({ [role.field]: next } as Partial<PlannerRow>)
                            }
                            members={members}
                            placeholder="Unassigned"
                            ariaLabel={role.label}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {unassignedCount > 0 || guestCount > 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-line bg-fill px-3 py-2.5 text-xs text-ink-soft">
                <Info size={14} weight="bold" className="mt-0.5 shrink-0" />
                <span>
                  {unassignedCount > 0
                    ? `${unassignedCount} ${unassignedCount === 1 ? 'slot is' : 'slots are'} still unassigned — you can fill them in on the meeting page. `
                    : null}
                  {guestCount > 0
                    ? `${guestCount} ${guestCount === 1 ? 'slot is' : 'slots are'} held by a guest; guests stay on the planner and are not carried into the meeting's roles.`
                    : null}
                </span>
              </div>
            ) : null}

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
      ) : null}
    </Modal>
  );
}
