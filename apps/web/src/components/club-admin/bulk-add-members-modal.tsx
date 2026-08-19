'use client';

import { Plus, X } from '@phosphor-icons/react/dist/ssr';
import { Alert, App, Button, Input, Modal, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';

import { ReadOnly } from '@/components/permissions/read-only';
import type {
  BulkCreateMemberFailure,
  CreateMemberInput,
  OfficerRole,
} from '@/lib/education/members';
import { OFFICER_ROLES } from '@/lib/education/members';
import { NAME_MAX, normalizePhone, PHONE_REGEX } from '@/lib/validation/rules';
import { useBulkCreateMembersMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const ROLE_OPTIONS = OFFICER_ROLES.map((role) => ({ value: role, label: role }));

const START_ROWS = 3;

interface RowDraft {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  roles: OfficerRole[];
}

const emptyRow = (): RowDraft => ({
  key: crypto.randomUUID(),
  firstName: '',
  lastName: '',
  phone: '',
  roles: [],
});

/** A row with nothing typed into it at all — ignored on submit. */
function isEmptyRow(row: RowDraft): boolean {
  return (
    !row.firstName.trim() && !row.lastName.trim() && !row.phone.trim() && row.roles.length === 0
  );
}

/** Per-row client validation mirroring the API DTOs; returns row key →
 * message for the first problem found on that row. */
function validateRows(rows: RowDraft[]): Map<string, string> {
  const errors = new Map<string, string>();
  const phonesSeen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const label = `Row ${index + 1}`;
    if (!row.firstName.trim()) errors.set(row.key, `${label}: first name is required`);
    else if (!row.lastName.trim()) errors.set(row.key, `${label}: last name is required`);
    else if (row.phone.trim()) {
      const phone = normalizePhone(row.phone.trim());
      if (!PHONE_REGEX.test(phone)) errors.set(row.key, `${label}: phone must be 11 digits`);
      else if (phonesSeen.has(phone)) {
        errors.set(row.key, `${label}: another row already uses this phone number`);
      } else phonesSeen.add(phone);
    }
  }
  return errors;
}

/** Clipboard text out of a spreadsheet: tab-separated columns
 * (first name, last name, phone), one person per line. */
function parsePastedRows(text: string): RowDraft[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [firstName = '', lastName = '', phone = ''] = line.split('\t');
      return {
        key: crypto.randomUUID(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        roles: [],
      };
    });
}

interface BulkAddMembersModalProps {
  open: boolean;
  onClose: () => void;
}

/** The "Bulk members" half of Add member — an editable grid for rostering a
 * whole intake at once. Every row becomes an unclaimed roster member (same as
 * the single add): no password or signup needed, assignable to meeting roles
 * immediately, claimable later via the per-row Invite action. Pasting a
 * first/last/phone block straight from a spreadsheet appends rows. */
export function BulkAddMembersModal({ open, onClose }: BulkAddMembersModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Add members in bulk"
      footer={null}
      width={920}
      destroyOnHidden
    >
      <ModalBody key={open ? 'open' : 'closed'} onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}

function ModalBody({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState<RowDraft[]>(() => Array.from({ length: START_ROWS }, emptyRow));
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  const [failures, setFailures] = useState<BulkCreateMemberFailure[]>([]);
  const [bulkCreate, { isLoading }] = useBulkCreateMembersMutation();

  function updateRow(key: string, patch: Partial<RowDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setRowErrors((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  /** Pasting a multi-cell spreadsheet block appends one row per line instead
   * of dumping everything into the focused cell. Single-value pastes pass
   * through untouched. */
  function handleGridPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
    event.preventDefault();
    const parsed = parsePastedRows(text);
    if (parsed.length === 0) return;
    setRows((current) => {
      // Drop trailing untouched rows so the paste reads as one continuous block.
      const kept = current.filter((row) => !isEmptyRow(row));
      return [...kept, ...parsed];
    });
    message.success(`Pasted ${parsed.length} ${parsed.length === 1 ? 'row' : 'rows'}`);
  }

  async function handleSubmit() {
    const active = rows.filter((row) => !isEmptyRow(row));
    const errors = validateRows(active);
    setRowErrors(errors);
    if (errors.size > 0) {
      message.error(errors.values().next().value ?? 'Some rows need attention');
      return;
    }
    const payload: CreateMemberInput[] = active.map((row) => ({
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      phone: row.phone.trim() || undefined,
      roles: row.roles.length > 0 ? row.roles : undefined,
    }));
    try {
      const result = await bulkCreate(payload).unwrap();
      if (result.failed.length === 0) {
        message.success(
          `Added ${result.created.length} ${result.created.length === 1 ? 'member' : 'members'}`,
        );
        onDone();
        return;
      }
      // Partial success: keep exactly the failed rows (highlighted with the
      // server's reason) so they can be fixed and resubmitted on their own.
      const failedKeys = new Map(
        result.failed.map((failure) => [active[failure.index]?.key ?? '', failure] as const),
      );
      setRows((current) => current.filter((row) => failedKeys.has(row.key)));
      setRowErrors(new Map([...failedKeys].map(([key, failure]) => [key, failure.message])));
      setFailures(result.failed);
      message.warning(
        `Added ${result.created.length}, skipped ${result.failed.length} — see the highlighted rows`,
      );
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't add these members. Please try again."));
    }
  }

  const filledCount = rows.filter((row) => !isEmptyRow(row)).length;

  const columns: ColumnsType<RowDraft> = [
    {
      title: '#',
      width: 40,
      render: (_value, _row, index) => <span className="text-xs text-ink-muted">{index + 1}</span>,
    },
    {
      title: 'First name',
      render: (_value, row) => (
        <Input
          aria-label="First name"
          placeholder="Aisha"
          value={row.firstName}
          maxLength={NAME_MAX}
          status={rowErrors.has(row.key) ? 'error' : ''}
          onChange={(event) => updateRow(row.key, { firstName: event.target.value })}
        />
      ),
    },
    {
      title: 'Last name',
      render: (_value, row) => (
        <Input
          aria-label="Last name"
          placeholder="Patel"
          value={row.lastName}
          maxLength={NAME_MAX}
          status={rowErrors.has(row.key) ? 'error' : ''}
          onChange={(event) => updateRow(row.key, { lastName: event.target.value })}
        />
      ),
    },
    {
      title: 'Phone (optional)',
      width: 180,
      render: (_value, row) => (
        <Input
          aria-label="Phone"
          placeholder="01568286512"
          inputMode="tel"
          value={row.phone}
          maxLength={14}
          status={rowErrors.has(row.key) ? 'error' : ''}
          title={rowErrors.get(row.key)}
          onChange={(event) => updateRow(row.key, { phone: event.target.value })}
        />
      ),
    },
    {
      title: 'Roles',
      width: 220,
      render: (_value, row) => (
        <Select
          aria-label="Roles"
          mode="multiple"
          className="w-full"
          placeholder="Member"
          value={row.roles}
          options={ROLE_OPTIONS}
          maxTagCount={1}
          onChange={(roles: OfficerRole[]) => updateRow(row.key, { roles })}
        />
      ),
    },
    {
      title: '',
      width: 44,
      render: (_value, row) => (
        <Button
          type="text"
          size="small"
          aria-label="Remove row"
          icon={<X size={14} />}
          disabled={rows.length <= 1}
          onClick={() => removeRow(row.key)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4" onPasteCapture={handleGridPaste}>
      <p className="text-sm text-ink-soft">
        Everyone added here joins the roster right away — no password or signup needed. Assign them
        to meetings and track their pathway immediately, then use the{' '}
        <strong className="text-ink">Invite</strong> action on their row whenever they&apos;re ready
        to claim the account. Tip: paste first name, last name and phone straight from a
        spreadsheet.
      </p>

      {failures.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={`${failures.length} ${failures.length === 1 ? 'row' : 'rows'} couldn't be added`}
          description={
            <ul className="m-0 list-disc pl-4">
              {failures.map((failure) => (
                <li key={`${failure.index}-${failure.firstName}-${failure.lastName}`}>
                  {failure.firstName} {failure.lastName}
                  {failure.phone ? ` (${failure.phone})` : ''} — {failure.message}
                </li>
              ))}
            </ul>
          }
        />
      ) : null}

      <Table<RowDraft>
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ y: 320 }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          icon={<Plus size={14} />}
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          Add row
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <ReadOnly resource="member" action="create">
            <Button
              type="primary"
              disabled={filledCount === 0}
              loading={isLoading}
              onClick={handleSubmit}
            >
              Add {filledCount > 0 ? filledCount : ''} {filledCount === 1 ? 'member' : 'members'}
            </Button>
          </ReadOnly>
        </div>
      </div>
    </div>
  );
}
