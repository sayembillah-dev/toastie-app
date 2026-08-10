'use client';

import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import type { Member } from '@/lib/education/members';
import type { DuesRecord } from '@/lib/finance/dues';
import { getDuesPeriod } from '@/lib/finance/dues';
import { formatMoney, fromMinor, toMinor } from '@/lib/finance/money';
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@/lib/finance/transactions';
import { amountRules } from '@/lib/validation/rules';
import { useUpdateDuesRecordMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface DuesPaymentModalProps {
  open: boolean;
  record: DuesRecord | null;
  member: Member | undefined;
  onClose: () => void;
}

interface FormValues {
  amount: number;
  paidOn: Dayjs;
  method: PaymentMethod;
  note: string;
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
  const [form] = Form.useForm<FormValues>();
  const period = getDuesPeriod(record.periodId);

  const [updateRecord, { isLoading }] = useUpdateDuesRecordMutation();

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await updateRecord({
        recordId: record.id,
        amountPaidMinor: toMinor(values.amount),
        waived: false,
        paidOn: values.paidOn.format('YYYY-MM-DD'),
        method: values.method,
        note: values.note.trim() === '' ? null : values.note.trim(),
      }).unwrap();
      message.success(`Payment recorded for ${member ? member.firstName : 'the member'}`);
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't record the payment. Please try again."));
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={isLoading}
      initialValues={{
        amount: fromMinor(
          record.amountPaidMinor > 0 ? record.amountPaidMinor : record.amountDueMinor,
        ),
        paidOn: dayjs(record.paidOn ?? undefined),
        method: (record.method as PaymentMethod) ?? 'cash',
        note: record.note ?? '',
      }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-lg bg-fill px-3 py-2 text-xs text-ink-soft">
        {member ? `${member.firstName} ${member.lastName}` : record.memberId} ·{' '}
        {period?.label ?? record.periodId} · Standard amount {formatMoney(record.amountDueMinor)}
      </div>

      <Form.Item
        label="Amount paid (total for this period)"
        name="amount"
        rules={amountRules({ label: 'Amount' })}
        className="!mb-0"
      >
        <InputNumber
          id="dues-amount"
          className="w-full"
          min={0}
          step={1}
          precision={2}
          prefix="৳"
        />
      </Form.Item>

      <div className="grid grid-cols-2 gap-3">
        <Form.Item
          label="Date"
          name="paidOn"
          rules={[{ required: true, message: 'Pick a payment date' }]}
          className="!mb-0"
        >
          <DatePicker id="dues-paid-on" className="w-full" format="D MMM YYYY" />
        </Form.Item>
        <Form.Item label="Method" name="method" className="!mb-0">
          <Select
            id="dues-method"
            options={PAYMENT_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }))}
          />
        </Form.Item>
      </div>

      <Form.Item
        label="Note (optional)"
        name="note"
        rules={[{ max: 200, message: 'Keep it under 200 characters' }]}
        className="!mb-0"
      >
        <Input.TextArea
          id="dues-note"
          placeholder="Anything worth remembering about this payment"
          maxLength={200}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
      </Form.Item>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" loading={isLoading} onClick={handleSave}>
          Save payment
        </Button>
      </div>
    </Form>
  );
}
