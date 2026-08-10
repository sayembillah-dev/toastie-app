'use client';

import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select } from 'antd';
import { useMemo } from 'react';

import type { BudgetLine } from '@/lib/finance/budget';
import { BUDGET_LINE_NOTE_MAX } from '@/lib/finance/budget';
import { formatMoney, fromMinor, toMinor } from '@/lib/finance/money';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type TransactionCategory,
} from '@/lib/finance/transactions';
import { amountRules } from '@/lib/validation/rules';
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

interface FormValues {
  category: TransactionCategory;
  planned: number;
  note: string;
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
  const [form] = Form.useForm<FormValues>();

  const availableCategories = useMemo(() => {
    const pool = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return pool.filter(
      (category) => category === line?.category || !excludeCategories.has(category),
    );
  }, [kind, excludeCategories, line]);

  const planned = Form.useWatch('planned', form) ?? 0;

  const [createLine, { isLoading: isCreating }] = useCreateBudgetLineMutation();
  const [updateLine, { isLoading: isUpdating }] = useUpdateBudgetLineMutation();
  const [deleteLine, { isLoading: isDeleting }] = useDeleteBudgetLineMutation();

  const busy = isCreating || isUpdating;

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      if (line) {
        await updateLine({
          lineId: line.id,
          plannedMinor: toMinor(values.planned),
          note: values.note.trim() === '' ? null : values.note.trim(),
        }).unwrap();
        message.success('Budget line updated');
      } else {
        await createLine({
          fiscalYear,
          kind,
          category: values.category,
          plannedMinor: toMinor(values.planned),
          note: values.note.trim() === '' ? undefined : values.note.trim(),
        }).unwrap();
        message.success('Budget line added');
      }
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't save the budget line. Please try again."));
    }
  }

  async function handleDelete() {
    if (!line) return;
    try {
      await deleteLine(line.id).unwrap();
      message.success('Budget line deleted');
      onDone();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Couldn't delete the budget line. Please try again."));
    }
  }

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
    <Form<FormValues>
      form={form}
      layout="vertical"
      disabled={busy}
      initialValues={{
        category: line?.category ?? availableCategories[0],
        planned: line ? fromMinor(line.plannedMinor) : 0,
        note: line?.note ?? '',
      }}
      className="flex flex-col gap-4"
    >
      <Form.Item label="Category" name="category" className="!mb-0">
        {line ? (
          <p className="text-sm text-ink">{CATEGORY_LABELS[line.category]}</p>
        ) : (
          <Select
            id="budget-category"
            options={availableCategories.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
          />
        )}
      </Form.Item>

      <Form.Item
        label={`Planned amount for FY ${fiscalYear}`}
        name="planned"
        rules={amountRules({ label: 'Planned amount', allowZero: true })}
        className="!mb-0"
      >
        <InputNumber
          id="budget-planned"
          className="w-full"
          min={0}
          step={1}
          precision={2}
          prefix="৳"
        />
      </Form.Item>

      <Form.Item
        label="Note (optional)"
        name="note"
        rules={[
          {
            max: BUDGET_LINE_NOTE_MAX,
            message: `Keep it under ${BUDGET_LINE_NOTE_MAX} characters`,
          },
        ]}
        className="!mb-0"
      >
        <Input.TextArea
          id="budget-note"
          placeholder="Assumptions behind this figure"
          maxLength={BUDGET_LINE_NOTE_MAX}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
      </Form.Item>

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
          <Button type="primary" loading={busy} onClick={handleSave}>
            {line ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </Form>
  );
}
