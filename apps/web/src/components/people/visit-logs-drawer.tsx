'use client';

import {
  CalendarCheck,
  CalendarPlus,
  Confetti,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, AutoComplete, Button, Drawer, Form, Input, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { Meeting } from '@/lib/meetings/meetings';
import type { Guest } from '@/lib/people/guests';
import type { VisitLog } from '@/lib/people/visit-logs';
import {
  COMMON_VISIT_ROLES,
  DEFAULT_VISIT_ROLE,
  VISIT_LOG_NOTES_MAX,
  VISIT_LOG_ROLE_MAX,
} from '@/lib/people/visit-logs';
import {
  useCreateVisitLogMutation,
  useDeleteVisitLogMutation,
  useGetMeetingsQuery,
  useGetVisitLogsQuery,
  useUpdateVisitLogMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface VisitLogsDrawerProps {
  guest: Guest;
  open: boolean;
  onClose: () => void;
}

const MEETING_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatMeetingDate(iso: string): string {
  return MEETING_DATE_FMT.format(new Date(iso));
}

/** Long-form label used on the log cards. */
function meetingHeadline(meeting: Meeting | undefined): {
  primary: string;
  secondary: string;
} {
  if (!meeting) return { primary: 'Meeting no longer on file', secondary: '' };
  return {
    primary: `#${meeting.meetingNumber} · ${formatMeetingDate(meeting.dateTime)}`,
    secondary: meeting.theme,
  };
}

type FormMode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; log: VisitLog };

export function VisitLogsDrawer({ guest, open, onClose }: VisitLogsDrawerProps) {
  /* Meetings feed both the Select in the form and the "which meeting" label
   * on every log card, so fetch on drawer-open and keep them in one place. */
  const { data: meetings } = useGetMeetingsQuery(undefined, { skip: !open });
  const { data: logs, isLoading } = useGetVisitLogsQuery(guest.id, { skip: !open });
  const [mode, setMode] = useState<FormMode>({ kind: 'closed' });

  const meetingsById = useMemo(() => {
    const map = new Map<string, Meeting>();
    for (const meeting of meetings ?? []) map.set(meeting.id, meeting);
    return map;
  }, [meetings]);

  const openCreate = () => setMode({ kind: 'create' });
  const openEdit = (log: VisitLog) => setMode({ kind: 'edit', log });
  const closeForm = () => setMode({ kind: 'closed' });

  const handleClose = () => {
    setMode({ kind: 'closed' });
    onClose();
  };

  const fullName = `${guest.firstName} ${guest.lastName}`;

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      placement="right"
      size="min(560px, 100vw)"
      title={
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-ink">Visit logs</div>
          <div className="text-xs font-normal text-ink-muted">
            Meetings {fullName} has attended — newest first. Auto entries come from meeting agendas.
          </div>
        </div>
      }
      styles={{ body: { paddingTop: 20, paddingBottom: 32 } }}
    >
      <div className="flex flex-col gap-4">
        {mode.kind === 'closed' ? (
          <Button
            block
            type="primary"
            size="middle"
            icon={<Plus size={16} weight="bold" />}
            onClick={openCreate}
          >
            Add visit
          </Button>
        ) : (
          <VisitLogForm guest={guest} mode={mode} meetings={meetings ?? []} onDone={closeForm} />
        )}

        <LogList
          logs={logs ?? []}
          loading={isLoading}
          guestId={guest.id}
          meetingsById={meetingsById}
          onEdit={openEdit}
          formOpen={mode.kind !== 'closed'}
          activeLogId={mode.kind === 'edit' ? mode.log.id : null}
        />
      </div>
    </Drawer>
  );
}

interface VisitLogFormProps {
  guest: Guest;
  mode: Exclude<FormMode, { kind: 'closed' }>;
  meetings: Meeting[];
  onDone: () => void;
}

interface FormValues {
  meetingId: string;
  role?: string;
  notes?: string;
}

function VisitLogForm({ guest, mode, meetings, onDone }: VisitLogFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [create, { isLoading: creating }] = useCreateVisitLogMutation();
  const [update, { isLoading: updating }] = useUpdateVisitLogMutation();
  const busy = creating || updating;

  const initialValues: FormValues = useMemo(
    () =>
      mode.kind === 'create'
        ? { meetingId: '', role: DEFAULT_VISIT_ROLE, notes: '' }
        : {
            meetingId: mode.log.meetingId,
            role: mode.log.role ?? '',
            notes: mode.log.notes ?? '',
          },
    [mode],
  );

  /* Newest meetings first — a fresh visit is nearly always for a recent
   * meeting, so putting them at the top of the Select saves a scroll. */
  const meetingOptions = useMemo(() => {
    return [...meetings]
      .sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1))
      .map((meeting) => ({
        value: meeting.id,
        label: (
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-ink-muted">
              #{meeting.meetingNumber}
            </span>
            <span className="shrink-0 text-xs text-ink-muted">
              {formatMeetingDate(meeting.dateTime)}
            </span>
            <span className="truncate text-sm text-ink">{meeting.theme}</span>
          </div>
        ),
        /* Filtered against the visible strings when the user types. */
        searchText: `${meeting.meetingNumber} ${meeting.theme}`.toLowerCase(),
      }));
  }, [meetings]);

  const roleSuggestions = useMemo(() => COMMON_VISIT_ROLES.map((role) => ({ value: role })), []);

  const submit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const role = values.role?.trim() || undefined;
    const notes = values.notes?.trim() || undefined;
    try {
      if (mode.kind === 'create') {
        await create({ guestId: guest.id, meetingId: values.meetingId, role, notes }).unwrap();
        message.success('Visit added');
      } else {
        await update({
          guestId: guest.id,
          logId: mode.log.id,
          meetingId: values.meetingId,
          role,
          notes,
        }).unwrap();
        message.success('Visit updated');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const heading = mode.kind === 'create' ? 'Add a visit' : 'Edit visit';
  const submitLabel = mode.kind === 'create' ? 'Save visit' : 'Save changes';

  return (
    <div className="rounded-2xl border border-line bg-canvas p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">{heading}</h3>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        requiredMark="optional"
        disabled={busy}
      >
        <Form.Item
          label="Which meeting?"
          name="meetingId"
          rules={[{ required: true, message: 'Pick a meeting' }]}
        >
          <Select<string>
            options={meetingOptions}
            placeholder="Pick a meeting"
            showSearch
            filterOption={(input, option) => {
              const text = (option as { searchText?: string })?.searchText ?? '';
              return text.includes(input.toLowerCase());
            }}
            notFoundContent="No meetings match that search"
          />
        </Form.Item>

        <Form.Item
          label="Role"
          name="role"
          rules={[
            {
              max: VISIT_LOG_ROLE_MAX,
              message: `Please keep the role under ${VISIT_LOG_ROLE_MAX} characters`,
            },
          ]}
          help="Anything the guest did on the night — pick a suggestion or type your own."
        >
          <AutoComplete
            options={roleSuggestions}
            placeholder="Guest"
            filterOption={(input, option) =>
              (option?.value ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          />
        </Form.Item>

        <Form.Item
          label="Notes"
          name="notes"
          /* Extra bottom margin so the button row clears the char counter that
           * antd renders inside the Form.Item's bottom-right corner. */
          className="!mb-6"
        >
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 8 }}
            maxLength={VISIT_LOG_NOTES_MAX}
            showCount
            placeholder="Anything worth remembering about their visit — optional."
          />
        </Form.Item>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button type="primary" loading={busy} onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      </Form>
    </div>
  );
}

interface LogListProps {
  logs: VisitLog[];
  loading: boolean;
  guestId: string;
  meetingsById: Map<string, Meeting>;
  onEdit: (log: VisitLog) => void;
  formOpen: boolean;
  activeLogId: string | null;
}

function LogList({
  logs,
  loading,
  guestId,
  meetingsById,
  onEdit,
  formOpen,
  activeLogId,
}: LogListProps) {
  const { message, modal } = App.useApp();
  const [deleteLog] = useDeleteVisitLogMutation();

  const confirmDelete = (log: VisitLog) => {
    modal.confirm({
      title: 'Delete this visit?',
      icon: <WarningCircle size={20} weight="fill" className="text-rose-600" />,
      content: (
        <p className="text-sm text-ink-soft">
          This removes the visit entry permanently. This action cannot be undone.
        </p>
      ),
      okText: 'Delete visit',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteLog({ guestId, logId: log.id }).unwrap();
          message.success('Visit deleted');
        } catch (err) {
          message.error(getApiErrorMessage(err));
          throw err;
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-24 animate-pulse rounded-2xl bg-fill" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <Confetti size={20} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">No visits yet</p>
        <p className="mt-1 text-xs text-ink-muted">
          Auto entries land here when the guest is named on a meeting agenda. You can also add
          visits by hand with the button above.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {logs.map((log) => (
        <li key={log.id}>
          <LogCard
            log={log}
            meeting={meetingsById.get(log.meetingId)}
            onEdit={() => onEdit(log)}
            onDelete={() => confirmDelete(log)}
            disabled={formOpen}
            highlighted={activeLogId === log.id}
          />
        </li>
      ))}
    </ul>
  );
}

interface LogCardProps {
  log: VisitLog;
  meeting: Meeting | undefined;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  highlighted: boolean;
}

function LogCard({ log, meeting, onEdit, onDelete, disabled, highlighted }: LogCardProps) {
  const { primary, secondary } = meetingHeadline(meeting);
  const isAuto = log.origin === 'meeting';

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${
        highlighted ? 'border-ink bg-fill' : 'border-line bg-canvas'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            {isAuto ? (
              <CalendarCheck size={16} weight="bold" />
            ) : (
              <CalendarPlus size={16} weight="bold" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink">{primary}</span>
              <OriginBadge origin={log.origin} />
            </div>
            {secondary ? (
              <div className="mt-0.5 truncate text-xs text-ink-muted">{secondary}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="text"
            size="small"
            aria-label="Edit visit"
            onClick={onEdit}
            disabled={disabled}
            icon={<PencilSimple size={14} weight="bold" className="text-ink-muted" />}
          />
          <Button
            type="text"
            size="small"
            aria-label="Delete visit"
            onClick={onDelete}
            disabled={disabled}
            icon={<Trash size={14} weight="bold" className="text-rose-600" />}
          />
        </div>
      </header>

      {log.role || log.notes || log.updatedAt ? (
        <div className="mt-3 flex flex-col gap-2">
          {log.role ? (
            <div className="flex items-center gap-2 text-xs text-ink-soft">
              <span className="font-medium uppercase tracking-wide text-ink-muted">Role</span>
              <span className="rounded-full bg-fill px-2 py-0.5 text-xs font-medium text-ink">
                {log.role}
              </span>
            </div>
          ) : null}
          {log.notes ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{log.notes}</p>
          ) : null}
          {log.updatedAt ? <div className="text-[11px] text-ink-muted">Edited</div> : null}
        </div>
      ) : null}
    </article>
  );
}

/** Small pill next to the meeting label. Auto entries are the norm once the
 * meeting agenda wiring lands, so they get the softer chip; manual entries
 * pick up an amber tint to nudge the officer's attention. */
function OriginBadge({ origin }: { origin: VisitLog['origin'] }) {
  if (origin === 'meeting') {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
        style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
      >
        Auto
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}
    >
      Manual
    </span>
  );
}
