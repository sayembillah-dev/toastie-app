'use client';

import { App, Button, Input, InputNumber, Modal, Popconfirm, Select } from 'antd';
import { useMemo, useState } from 'react';

import type { BudgetLine } from '@/lib/finance/budget';
import { BUDGET_LINE_NOTE_MAX } from '@/lib/finance/budget';
import { formatMoney, fromMinor, toMinor } from '@/lib/finance/money';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type TransactionCategory,
} from '@/lib/finance/transactions';
import {
  useCreateBudgetLineMutation,
  useDeleteBudgetLineMutation,
  useUpdateBudgetLineMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface BudgetLineModalProps {
  open: boolean;
  fiscalYear: string;
  kind: 'income' | 'expense';
  /** When present, the modal edits (and can delete) this line; when null, it
   * creates a new one for whichever category the treasurer picks. */
  line: BudgetLine | null;
  /** Categories that already have a line for this fiscal year — offered only
   * when creating, so the same category can't be budgeted twice. */
  excludeCategories: Set<TransactionCategory>;
  onClose: () => void;
}

export function BudgetLineModal({
  open,
  fiscalYear,
  kind,
  line,
  excludeCategories,
  onClose,
}: BudgetLineModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={line ? `Edit ${CATEGORY_LABELS[line.category]}` : `Add ${kind} line`}
      footer={null}
      destroyOnHidden
    >
      <ModalBody
        key={line?.id ?? `new-${kind}`}
        fiscalYear={fiscalYear}
        kind={kind}
        line={line}
        excludeCategories={excludeCategories}
        onDone={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}

interface ModalBodyProps {
  fiscalYear: string;
  kind: 'income' | 'expense';
  line: BudgetLine | null;
  excludeCategories: Set<TransactionCategory>;
  onDone: () => void;
  onCancel: () => void;
}

function ModalBody({
  fiscalYear,
  kind,
  line,
  excludeCategories,
  onDone,
  onCancel,
}: ModalBodyProps) {
  const { message } = App.useApp();

  const availableCategories = useMemo(() => {
    const pool = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return pool.filter(
      (category) => category === line?.category || !excludeCategories.has(category),
    );
  }, [kind, excludeCategories, line]);

  const [category, setCategory] = useState<TransactionCategory>(
    line?.category ?? availableCategories[0],
  );
  const [planned, setPlanned] = useState<number>(line ? fromMinor(line.plannedMinor) : 0);
  const [note, setNote] = useState(line?.note ?? '');

  const [createLine, { isLoading: isCreating }] = useCreateBudgetLineMutation();
  const [updateLine, { isLoading: isUpdating }] = useUpdateBudgetLineMutation();
  const [deleteLine, { isLoading: isDeleting }] = useDeleteBudgetLineMutation();

  const busy = isCreating || isUpdating;
  const canSave = planned >= 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (line) {
        await updateLine({
          lineId: line.id,
          plannedMinor: toMinor(planned),
          note: note.trim() === '' ? null : note.trim(),
        }).unwrap();
        message.success('Budget line updated');
      } else {
        await createLine({
          fiscalYear,
          kind,
          category,
          plannedMinor: toMinor(planned),
          note: note.trim() === '' ? undefined : note.trim(),
        }).unwrap();
        message.success('Budget line added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the budget line'));
    }
  };

  const handleDelete = async () => {
    if (!line) return;
    try {
      await deleteLine(line.id).unwrap();
      message.success('Budget line deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the budget line'));
    }
  };

  if (!line && availableCategories.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">
          Every {kind} category already has a budget line for FY {fiscalYear}. Edit an existing line
          instead.
        </p>
        <div className="flex justify-end">
          <Button onClick={onCancel}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget-category" className="text-sm font-medium text-ink">
          Category
        </label>
        {line ? (
          <p className="text-sm text-ink">{CATEGORY_LABELS[line.category]}</p>
        ) : (
          <Select
            id="budget-category"
            value={category}
            onChange={setCategory}
            options={availableCategories.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget-planned" className="text-sm font-medium text-ink">
          Planned amount for FY {fiscalYear}
        </label>
        <InputNumber
          id="budget-planned"
          className="w-full"
          min={0}
          step={1}
          precision={2}
          prefix="৳"
          value={planned}
          onChange={(value) => setPlanned(value ?? 0)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget-note" className="text-sm font-medium text-ink">
          Note (optional)
        </label>
        <Input.TextArea
          id="budget-note"
          placeholder="Assumptions behind this figure"
          value={note}
          maxLength={BUDGET_LINE_NOTE_MAX}
          autoSize={{ minRows: 2, maxRows: 4 }}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {planned > 0 ? (
        <p className="text-xs text-ink-muted">
          Plans for {formatMoney(toMinor(planned))} this year.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {line ? (
          <Popconfirm
            title="Delete this budget line?"
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
          <Button type="primary" disabled={!canSave} loading={busy} onClick={handleSave}>
            {line ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}
