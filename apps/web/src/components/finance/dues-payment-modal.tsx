'use client';

import { App, Button, DatePicker, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import type { Member } from '@/lib/education/members';
import type { DuesRecord } from '@/lib/finance/dues';
import { getDuesPeriod } from '@/lib/finance/dues';
import { formatMoney, fromMinor, toMinor } from '@/lib/finance/money';
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@/lib/finance/transactions';
import { useUpdateDuesRecordMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface DuesPaymentModalProps {
  open: boolean;
  record: DuesRecord | null;
  member: Member | undefined;
  onClose: () => void;
}

/** Records how much a member has paid toward a period's dues. The amount here
 * is the running total for the period, not an increment — the server keeps
 * exactly one linked ledger entry per record and updates its amount, so
 * re-opening this after a partial payment shows the total paid so far. */
export function DuesPaymentModal({ open, record, member, onClose }: DuesPaymentModalProps) {
  return (
    <Modal open={open} onCancel={onClose} title="Record dues payment" footer={null} destroyOnHidden>
      {record ? (
        <ModalBody
          key={record.id}
          record={record}
          member={member}
          onDone={onClose}
          onCancel={onClose}
        />
      ) : null}
    </Modal>
  );
}

interface ModalBodyProps {
  record: DuesRecord;
  member: Member | undefined;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ record, member, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const period = getDuesPeriod(record.periodId);
  const [amount, setAmount] = useState<number>(
    fromMinor(record.amountPaidMinor > 0 ? record.amountPaidMinor : record.amountDueMinor),
  );
  const [paidOn, setPaidOn] = useState(() => dayjs(record.paidOn ?? undefined));
  const [method, setMethod] = useState<PaymentMethod>((record.method as PaymentMethod) ?? 'cash');
  const [note, setNote] = useState(record.note ?? '');

  const [updateRecord, { isLoading }] = useUpdateDuesRecordMutation();

  const canSave = amount > 0 && !isLoading;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await updateRecord({
        recordId: record.id,
        amountPaidMinor: toMinor(amount),
        waived: false,
        paidOn: paidOn.format('YYYY-MM-DD'),
        method,
        note: note.trim() === '' ? null : note.trim(),
      }).unwrap();
      message.success(`Payment recorded for ${member ? member.firstName : 'the member'}`);
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not record the payment'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-fill px-3 py-2 text-xs text-ink-soft">
        {member ? `${member.firstName} ${member.lastName}` : record.memberId} ·{' '}
        {period?.label ?? record.periodId} · Standard amount {formatMoney(record.amountDueMinor)}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dues-amount" className="text-sm font-medium text-ink">
          Amount paid (total for this period)
        </label>
        <InputNumber
          id="dues-amount"
          className="w-full"
          min={0}
          step={1}
          precision={2}
          prefix="৳"
          value={amount}
          onChange={(value) => setAmount(value ?? 0)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dues-paid-on" className="text-sm font-medium text-ink">
            Date
          </label>
          <DatePicker
            id="dues-paid-on"
            className="w-full"
            value={paidOn}
            onChange={(value) => value && setPaidOn(value)}
            format="D MMM YYYY"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dues-method" className="text-sm font-medium text-ink">
            Method
          </label>
          <Select
            id="dues-method"
            value={method}
            onChange={setMethod}
            options={PAYMENT_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dues-note" className="text-sm font-medium text-ink">
          Note (optional)
        </label>
        <Input.TextArea
          id="dues-note"
          placeholder="Anything worth remembering about this payment"
          value={note}
          maxLength={200}
          autoSize={{ minRows: 2, maxRows: 4 }}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" disabled={!canSave} loading={isLoading} onClick={handleSave}>
          Save payment
        </Button>
      </div>
    </div>
  );
}
