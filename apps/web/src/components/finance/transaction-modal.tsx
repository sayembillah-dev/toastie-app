'use client';

import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo } from 'react';
import { ReadOnly } from '@/components/permissions/read-only';
import { formatMoney, fromMinor, toMinor } from '@/lib/finance/money';
import type { Transaction, TransactionCategory, TxDirection } from '@/lib/finance/transactions';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  TRANSACTION_COUNTERPARTY_MAX,
  TRANSACTION_DESCRIPTION_MAX,
  TRANSACTION_REFERENCE_MAX,
} from '@/lib/finance/transactions';
import { amountRules, textFieldRules } from '@/lib/validation/rules';
import {
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useUpdateTransactionMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface TransactionModalProps {
  open: boolean;
  /** When present, the modal is in edit mode; when null, it creates a new row. */
  transaction: Transaction | null;
  onClose: () => void;
}

interface FormValues {
  direction: TxDirection;
  category: TransactionCategory;
  amount: number;
  date: Dayjs;
  description: string;
  method: PaymentMethod;
  counterparty: string;
  reference: string;
}

/** Add / edit / delete dialog for a single ledger entry — same shape as the
 * inventory item modal, one form serving both the create and update flow. */
export function TransactionModal({ open, transaction, onClose }: TransactionModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={transaction ? 'Edit transaction' : 'Add transaction'}
      footer={null}
      destroyOnHidden
    >
      <ModalBody
        key={transaction?.id ?? 'new'}
        transaction={transaction}
        onDone={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}

interface ModalBodyProps {
  transaction: Transaction | null;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({ transaction, onDone, onCancel }: ModalBodyProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const [createTx, { isLoading: isCreating }] = useCreateTransactionMutation();
  const [updateTx, { isLoading: isUpdating }] = useUpdateTransactionMutation();
  const [deleteTx, { isLoading: isDeleting }] = useDeleteTransactionMutation();

  const direction = Form.useWatch('direction', form) ?? transaction?.direction ?? 'out';
  const amount = Form.useWatch('amount', form) ?? 0;

  const categoryOptions = useMemo(
    () =>
      (direction === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((value) => ({
        value,
        label: CATEGORY_LABELS[value],
      })),
    [direction],
  );

  function handleDirectionChange(next: TxDirection) {
    const current = form.getFieldValue('category') as TransactionCategory | undefined;
    const options = next === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!current || !(options as readonly string[]).includes(current)) {
      form.setFieldsValue({ category: options[0] });
    }
    form.setFieldsValue({ direction: next });
  }

  const busy = isCreating || isUpdating;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const body = {
      date: values.date.format('YYYY-MM-DD'),
      direction: values.direction,
      category: values.category,
      amountMinor: toMinor(values.amount),
      description: values.description.trim(),
      method: values.method,
      counterparty: values.counterparty.trim() === '' ? undefined : values.counterparty.trim(),
      reference: values.reference.trim() === '' ? undefined : values.reference.trim(),
    };
    try {
      if (transaction) {
        await updateTx({ transactionId: transaction.id, ...body }).unwrap();
        message.success('Transaction updated');
      } else {
        await createTx(body).unwrap();
        message.success('Transaction added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't save the transaction. Please try again."));
    }
  }

  async function handleDelete() {
    if (!transaction) return;
    try {
      await deleteTx(transaction.id).unwrap();
      message.success('Transaction deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't delete the transaction. Please try again."));
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={busy}
      initialValues={{
        direction: transaction?.direction ?? 'out',
        category: transaction?.category ?? EXPENSE_CATEGORIES[0],
        amount: transaction ? fromMinor(transaction.amountMinor) : 0,
        date: dayjs(transaction?.date ?? undefined),
        description: transaction?.description ?? '',
        method: transaction?.method ?? 'cash',
        counterparty: transaction?.counterparty ?? '',
        reference: transaction?.reference ?? '',
      }}
      className="flex flex-col gap-4"
    >
      {/* Fields and write buttons are fenced; Cancel stays live so a reader
       * can still back out of a row they opened to look at. */}
      <ReadOnly
        resource="transaction"
        action={transaction ? 'update' : 'create'}
        display="block"
        className="flex flex-col gap-4"
      >
        <Form.Item name="direction" className="!mb-0">
          <Segmented
            block
            onChange={(value) => handleDirectionChange(value as TxDirection)}
            options={[
              { label: 'Money in', value: 'in' },
              { label: 'Money out', value: 'out' },
            ]}
          />
        </Form.Item>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            label="Amount"
            name="amount"
            rules={amountRules({ label: 'Amount' })}
            className="!mb-0"
          >
            <InputNumber
              id="tx-amount"
              className="w-full"
              min={0}
              step={1}
              precision={2}
              prefix="৳"
            />
          </Form.Item>
          <Form.Item
            label="Date"
            name="date"
            rules={[{ required: true, message: 'Pick a date' }]}
            className="!mb-0"
          >
            <DatePicker id="tx-date" className="w-full" format="D MMM YYYY" />
          </Form.Item>
        </div>

        <Form.Item label="Category" name="category" className="!mb-0">
          <Select id="tx-category" options={categoryOptions} />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
          rules={textFieldRules({ label: 'Description', max: TRANSACTION_DESCRIPTION_MAX })}
          className="!mb-0"
        >
          <Input
            id="tx-description"
            placeholder="What was this for?"
            maxLength={TRANSACTION_DESCRIPTION_MAX}
            showCount
          />
        </Form.Item>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item label="Method" name="method" className="!mb-0">
            <Select
              id="tx-method"
              options={PAYMENT_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }))}
            />
          </Form.Item>
          <Form.Item
            label="Payee / payer"
            name="counterparty"
            rules={[
              {
                max: TRANSACTION_COUNTERPARTY_MAX,
                message: `Keep it under ${TRANSACTION_COUNTERPARTY_MAX} characters`,
              },
            ]}
            className="!mb-0"
          >
            <Input
              id="tx-counterparty"
              placeholder="Optional"
              maxLength={TRANSACTION_COUNTERPARTY_MAX}
            />
          </Form.Item>
        </div>

        <Form.Item
          label="Reference (optional)"
          name="reference"
          rules={[
            {
              max: TRANSACTION_REFERENCE_MAX,
              message: `Keep it under ${TRANSACTION_REFERENCE_MAX} characters`,
            },
          ]}
          className="!mb-0"
        >
          <Input
            id="tx-reference"
            placeholder="Receipt number, cheque number, transfer id…"
            maxLength={TRANSACTION_REFERENCE_MAX}
          />
        </Form.Item>

        {amount > 0 ? (
          <p className="text-xs text-ink-muted">
            This will record {formatMoney(toMinor(amount))} {direction === 'in' ? 'in' : 'out'}.
          </p>
        ) : null}
      </ReadOnly>

      <div className="flex items-center justify-between gap-2">
        {transaction ? (
          <ReadOnly resource="transaction" action="delete">
            <Popconfirm
              title="Delete this transaction?"
              description="This cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true, loading: isDeleting }}
              cancelText="Cancel"
              onConfirm={handleDelete}
            >
              <Button danger disabled={busy || isDeleting}>
                Delete
              </Button>
            </Popconfirm>
          </ReadOnly>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <ReadOnly resource="transaction" action={transaction ? 'update' : 'create'}>
            <Button type="primary" loading={isCreating || isUpdating} onClick={handleSave}>
              {transaction ? 'Save' : 'Add'}
            </Button>
          </ReadOnly>
        </div>
      </div>
    </Form>
  );
}
