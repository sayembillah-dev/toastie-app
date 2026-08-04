'use client';

import {
  App,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
} from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

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
  const [direction, setDirection] = useState<TxDirection>(transaction?.direction ?? 'out');
  const [category, setCategory] = useState<TransactionCategory>(
    transaction?.category ?? EXPENSE_CATEGORIES[0],
  );
  const [amount, setAmount] = useState<number>(
    transaction ? fromMinor(transaction.amountMinor) : 0,
  );
  const [date, setDate] = useState(() => dayjs(transaction?.date ?? undefined));
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [method, setMethod] = useState<PaymentMethod>(transaction?.method ?? 'cash');
  const [counterparty, setCounterparty] = useState(transaction?.counterparty ?? '');
  const [reference, setReference] = useState(transaction?.reference ?? '');

  const [createTx, { isLoading: isCreating }] = useCreateTransactionMutation();
  const [updateTx, { isLoading: isUpdating }] = useUpdateTransactionMutation();
  const [deleteTx, { isLoading: isDeleting }] = useDeleteTransactionMutation();

  const categoryOptions = useMemo(
    () =>
      (direction === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((value) => ({
        value,
        label: CATEGORY_LABELS[value],
      })),
    [direction],
  );

  function handleDirectionChange(next: TxDirection) {
    setDirection(next);
    const options = next === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!(options as readonly string[]).includes(category)) {
      setCategory(options[0]);
    }
  }

  const trimmedDescription = description.trim();
  const busy = isCreating || isUpdating;
  const canSave = amount > 0 && trimmedDescription.length > 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    const body = {
      date: date.format('YYYY-MM-DD'),
      direction,
      category,
      amountMinor: toMinor(amount),
      description: trimmedDescription,
      method,
      counterparty: counterparty.trim() === '' ? undefined : counterparty.trim(),
      reference: reference.trim() === '' ? undefined : reference.trim(),
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
      message.error(getApiErrorMessage(err, 'Could not save the transaction'));
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    try {
      await deleteTx(transaction.id).unwrap();
      message.success('Transaction deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the transaction'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        block
        value={direction}
        onChange={(value) => handleDirectionChange(value as TxDirection)}
        options={[
          { label: 'Money in', value: 'in' },
          { label: 'Money out', value: 'out' },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-amount" className="text-sm font-medium text-ink">
            Amount
          </label>
          <InputNumber
            id="tx-amount"
            className="w-full"
            min={0}
            step={1}
            precision={2}
            prefix="৳"
            value={amount}
            onChange={(value) => setAmount(value ?? 0)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-date" className="text-sm font-medium text-ink">
            Date
          </label>
          <DatePicker
            id="tx-date"
            className="w-full"
            value={date}
            onChange={(value) => value && setDate(value)}
            format="D MMM YYYY"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tx-category" className="text-sm font-medium text-ink">
          Category
        </label>
        <Select
          id="tx-category"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tx-description" className="text-sm font-medium text-ink">
          Description
        </label>
        <Input
          id="tx-description"
          placeholder="What was this for?"
          value={description}
          maxLength={TRANSACTION_DESCRIPTION_MAX}
          showCount
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-method" className="text-sm font-medium text-ink">
            Method
          </label>
          <Select
            id="tx-method"
            value={method}
            onChange={setMethod}
            options={PAYMENT_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-counterparty" className="text-sm font-medium text-ink">
            Payee / payer
          </label>
          <Input
            id="tx-counterparty"
            placeholder="Optional"
            value={counterparty}
            maxLength={TRANSACTION_COUNTERPARTY_MAX}
            onChange={(event) => setCounterparty(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tx-reference" className="text-sm font-medium text-ink">
          Reference (optional)
        </label>
        <Input
          id="tx-reference"
          placeholder="Receipt number, cheque number, transfer id…"
          value={reference}
          maxLength={TRANSACTION_REFERENCE_MAX}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>

      {amount > 0 ? (
        <p className="text-xs text-ink-muted">
          This will record {formatMoney(toMinor(amount))} {direction === 'in' ? 'in' : 'out'}.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {transaction ? (
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
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            disabled={!canSave}
            loading={isCreating || isUpdating}
            onClick={handleSave}
          >
            {transaction ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
