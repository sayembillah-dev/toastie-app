'use client';

import {
  ChatCircleText,
  ChatsCircle,
  DotsThreeCircle,
  EnvelopeSimple,
  HandWaving,
  PencilSimple,
  Phone,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Drawer, Form, Input, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { ContactLog, ContactMethod } from '@/lib/people/contact-logs';
import {
  CONTACT_LOG_OUTCOME_MAX,
  CONTACT_METHODS,
  getContactMethod,
} from '@/lib/people/contact-logs';
import type { Guest } from '@/lib/people/guests';
import { getGuestFullName } from '@/lib/people/guests';
import {
  useCreateContactLogMutation,
  useDeleteContactLogMutation,
  useGetContactLogsQuery,
  useUpdateContactLogMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface ContactLogsDrawerProps {
  guest: Guest;
  open: boolean;
  onClose: () => void;
}

/** Small phosphor icon per method — kept module-level so the Select options and
 * the log-card avatar draw from the same map. */
const METHOD_ICONS: Record<ContactMethod, React.ReactNode> = {
  call: <Phone size={16} weight="bold" />,
  message: <ChatCircleText size={16} weight="bold" />,
  email: <EnvelopeSimple size={16} weight="bold" />,
  'in-person': <HandWaving size={16} weight="bold" />,
  other: <DotsThreeCircle size={16} weight="bold" />,
};

function methodIcon(method: ContactMethod): React.ReactNode {
  return METHOD_ICONS[method] ?? METHOD_ICONS.other;
}

const METHOD_OPTIONS = CONTACT_METHODS.map((entry) => ({
  value: entry.id,
  label: (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-5 items-center justify-center rounded-full bg-fill text-ink-soft"
      >
        {methodIcon(entry.id)}
      </span>
      <span className="text-sm">{entry.label}</span>
    </span>
  ),
}));

/** Full date+time for older entries — the drawer leans on relative for the last
 * day and the absolute stamp beyond that so the officer keeps a sense of pace. */
const ABS_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Recent entries read as "12 min ago" so the officer can eyeball who's warm
 * vs cooling; anything past 24h earns the full date. */
function formatLogTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return ABS_FMT.format(then);
}

type FormMode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; log: ContactLog };

export function ContactLogsDrawer({ guest, open, onClose }: ContactLogsDrawerProps) {
  /* Skip the query until the drawer opens — nobody sees the contents while it
   * is closed, so there's no point paying for a fetch (or, later on, a WS
   * subscription) just to feed a hidden panel. */
  const { data: logs, isLoading } = useGetContactLogsQuery(guest.id, { skip: !open });
  const [mode, setMode] = useState<FormMode>({ kind: 'closed' });

  const openCreate = () => setMode({ kind: 'create' });
  const openEdit = (log: ContactLog) => setMode({ kind: 'edit', log });
  const closeForm = () => setMode({ kind: 'closed' });

  /* Reset the form on the way out so an unsaved edit from a previous session
   * never bleeds through when the drawer is reopened. The whole GuestActions
   * tree unmounts on guest navigation, so there is no in-flight guest swap to
   * worry about. */
  const handleClose = () => {
    setMode({ kind: 'closed' });
    onClose();
  };

  const fullName = getGuestFullName(guest);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      placement="right"
      size="min(560px, 100vw)"
      title={
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-ink">Contact logs</div>
          <div className="text-xs font-normal text-ink-muted">
            Every follow-up with {fullName} — most recent first.
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
            Add log
          </Button>
        ) : (
          <ContactLogForm guest={guest} mode={mode} onDone={closeForm} />
        )}

        <LogList
          logs={logs ?? []}
          loading={isLoading}
          guestId={guest.id}
          onEdit={openEdit}
          formOpen={mode.kind !== 'closed'}
          activeLogId={mode.kind === 'edit' ? mode.log.id : null}
        />
      </div>
    </Drawer>
  );
}

interface ContactLogFormProps {
  guest: Guest;
  mode: Exclude<FormMode, { kind: 'closed' }>;
  onDone: () => void;
}

interface FormValues {
  method: ContactMethod;
  outcome: string;
}

function ContactLogForm({ guest, mode, onDone }: ContactLogFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [create, { isLoading: creating }] = useCreateContactLogMutation();
  const [update, { isLoading: updating }] = useUpdateContactLogMutation();
  const busy = creating || updating;

  const initialValues: FormValues = useMemo(
    () =>
      mode.kind === 'create'
        ? { method: 'call', outcome: '' }
        : { method: mode.log.method, outcome: mode.log.outcome },
    [mode],
  );

  const submit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const outcome = values.outcome.trim();
    try {
      if (mode.kind === 'create') {
        await create({ guestId: guest.id, method: values.method, outcome }).unwrap();
        message.success('Log added');
      } else {
        await update({
          guestId: guest.id,
          logId: mode.log.id,
          method: values.method,
          outcome,
        }).unwrap();
        message.success('Log updated');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const heading = mode.kind === 'create' ? 'Add a contact log' : 'Edit contact log';
  const submitLabel = mode.kind === 'create' ? 'Save log' : 'Save changes';

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
          label="How did you reach them?"
          name="method"
          rules={[{ required: true, message: 'Pick how you reached them' }]}
        >
          <Select<ContactMethod>
            options={METHOD_OPTIONS}
            placeholder="Pick a method"
            /* `optionLabelProp="value"` would show the icon in the closed
             * state too — we let it default so the closed input renders the
             * plain text label, keeping the field short on mobile. */
          />
        </Form.Item>

        <Form.Item
          label="What happened next?"
          name="outcome"
          rules={[{ required: true, whitespace: true, message: 'Tell us what happened next' }]}
          /* Extra bottom margin so the button row clears the char counter that
           * antd renders inside the Form.Item's bottom-right corner. */
          className="!mb-6"
        >
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 8 }}
            maxLength={CONTACT_LOG_OUTCOME_MAX}
            showCount
            placeholder="They said they'd think it over and reply by Friday…"
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
  logs: ContactLog[];
  loading: boolean;
  guestId: string;
  onEdit: (log: ContactLog) => void;
  formOpen: boolean;
  activeLogId: string | null;
}

function LogList({ logs, loading, guestId, onEdit, formOpen, activeLogId }: LogListProps) {
  const { message, modal } = App.useApp();
  const [deleteLog] = useDeleteContactLogMutation();

  const confirmDelete = (log: ContactLog) => {
    modal.confirm({
      title: 'Delete this log?',
      icon: <WarningCircle size={20} weight="fill" className="text-rose-600" />,
      content: (
        <p className="text-sm text-ink-soft">
          This removes the log entry permanently. This action cannot be undone.
        </p>
      ),
      okText: 'Delete log',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteLog({ guestId, logId: log.id }).unwrap();
          message.success('Log deleted');
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
          <ChatsCircle size={20} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">No contact logs yet</p>
        <p className="mt-1 text-xs text-ink-muted">
          Tap Add log to note down calls, messages and catch-ups as they happen.
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
            onEdit={() => onEdit(log)}
            onDelete={() => confirmDelete(log)}
            /* Buttons dim while the form is open, and the card being edited
             * gets a subtle ring so it's easy to spot mid-scroll. */
            disabled={formOpen}
            highlighted={activeLogId === log.id}
          />
        </li>
      ))}
    </ul>
  );
}

interface LogCardProps {
  log: ContactLog;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  highlighted: boolean;
}

function LogCard({ log, onEdit, onDelete, disabled, highlighted }: LogCardProps) {
  const meta = getContactMethod(log.method);
  const timeLabel = formatLogTime(log.createdAt);

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
            {methodIcon(log.method)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{meta.label}</div>
            <div className="text-xs text-ink-muted">
              {timeLabel}
              {log.updatedAt ? <span className="ml-1">· edited</span> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="text"
            size="small"
            aria-label="Edit log"
            onClick={onEdit}
            disabled={disabled}
            icon={<PencilSimple size={14} weight="bold" className="text-ink-muted" />}
          />
          <Button
            type="text"
            size="small"
            aria-label="Delete log"
            onClick={onDelete}
            disabled={disabled}
            icon={<Trash size={14} weight="bold" className="text-rose-600" />}
          />
        </div>
      </header>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
        {log.outcome}
      </p>
    </article>
  );
}
