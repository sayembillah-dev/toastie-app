'use client';

import {
  CalendarBlank,
  DotsThreeOutline,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Input } from 'antd';
import { Fragment, useState } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import type { Assignee, PlannerRow } from '@/lib/education/planner';
import { createEmptyRow } from '@/lib/education/planner';
import { useGetMembersQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/* -----------------------------------------------------------------------------
 * Column config
 * The table renders many similar cells, so a small config drives both the
 * header sub-row and every body row. Widths, labels and group tints live here.
 * -------------------------------------------------------------------------- */

type AssigneeField =
  | 'tmod'
  | 'ttm'
  | 'ttEvaluator'
  | 'speaker1'
  | 'evaluator1'
  | 'speaker2'
  | 'evaluator2'
  | 'speaker3'
  | 'evaluator3'
  | 'generalEvaluator'
  | 'timer'
  | 'ahCounter'
  | 'grammarian';

type Tint = 'none' | 'amber' | 'blue' | 'violet' | 'teal' | 'slate';

interface AssigneeCol {
  field: AssigneeField;
  label: string;
  minWidth: number;
  tint: Tint;
}

const TMOD_COLUMN: AssigneeCol = { field: 'tmod', label: 'TMOD', minWidth: 200, tint: 'none' };

/** Every column that lives inside a visual group. Order matters — it drives
 * the sub-header row and every tbody row's cell order. */
const GROUPED_ASSIGNEE_COLUMNS: AssigneeCol[] = [
  { field: 'ttm', label: 'TTM', minWidth: 200, tint: 'amber' },
  { field: 'ttEvaluator', label: 'TT Evaluator', minWidth: 200, tint: 'amber' },
  { field: 'speaker1', label: 'Speaker 1', minWidth: 200, tint: 'blue' },
  { field: 'evaluator1', label: 'Evaluator 1', minWidth: 200, tint: 'blue' },
  { field: 'speaker2', label: 'Speaker 2', minWidth: 200, tint: 'violet' },
  { field: 'evaluator2', label: 'Evaluator 2', minWidth: 200, tint: 'violet' },
  { field: 'speaker3', label: 'Speaker 3', minWidth: 200, tint: 'teal' },
  { field: 'evaluator3', label: 'Evaluator 3', minWidth: 200, tint: 'teal' },
  { field: 'generalEvaluator', label: 'General Evaluator', minWidth: 200, tint: 'slate' },
  { field: 'timer', label: 'Timer', minWidth: 170, tint: 'slate' },
  { field: 'ahCounter', label: 'Ah-counter', minWidth: 170, tint: 'slate' },
  { field: 'grammarian', label: 'Grammarian', minWidth: 200, tint: 'slate' },
];

const ALL_ASSIGNEE_COLUMNS: AssigneeCol[] = [TMOD_COLUMN, ...GROUPED_ASSIGNEE_COLUMNS];

/* Tailwind can't read dynamic class names, so every colour used gets a literal
 * class string here — the tree-shaker keeps them in the CSS. */
function subHeaderGroupClass(tint: Tint): string {
  switch (tint) {
    case 'amber':
      return 'bg-amber-50/60 text-ink';
    case 'blue':
      return 'bg-blue-50/60 text-ink';
    case 'violet':
      return 'bg-violet-50/60 text-ink';
    case 'teal':
      return 'bg-teal-50/60 text-ink';
    case 'slate':
      return 'bg-slate-50/60 text-ink';
    default:
      return 'bg-sidebar text-ink';
  }
}

/* -----------------------------------------------------------------------------
 * Empty-state seed
 * Three blank rows so the visual language reads on first load — the VPE can
 * start assigning without clicking Add first. Rows are ephemeral until the
 * back-end lands; wiring will move to RTK Query later.
 * -------------------------------------------------------------------------- */

/* -----------------------------------------------------------------------------
 * Month grouping
 * A divider row is inserted whenever a row's month differs from the previous
 * row's — rows with no date don't trigger a divider and just flow inline.
 * -------------------------------------------------------------------------- */

function monthKey(dateTime: string | null): string | null {
  // datetime-local strings are "YYYY-MM-DDTHH:mm" — the first 7 chars are the
  // month key we compare against neighbours.
  return dateTime ? dateTime.slice(0, 7) : null;
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
});

function monthLabel(dateTime: string): string {
  return MONTH_LABEL_FMT.format(new Date(dateTime));
}

function seedRows(): PlannerRow[] {
  const rid = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `pr-${Math.random().toString(36).slice(2)}`;
  return [createEmptyRow(rid(), 1), createEmptyRow(rid(), 2), createEmptyRow(rid(), 3)];
}

/* -----------------------------------------------------------------------------
 * PlannerTab
 * -------------------------------------------------------------------------- */

export function PlannerTab() {
  const { data: members = [], isLoading, isError, error } = useGetMembersQuery();
  const [rows, setRows] = useState<PlannerRow[]>(seedRows);

  function updateRow(id: string, patch: Partial<PlannerRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateAssignee(id: string, field: AssigneeField, next: Assignee | null) {
    updateRow(id, { [field]: next } as Partial<PlannerRow>);
  }

  function addRow() {
    setRows((prev) => {
      const nextNumber = (prev[prev.length - 1]?.meetingNumber ?? 0) + 1;
      const rid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `pr-${Math.random().toString(36).slice(2)}`;
      return [...prev, createEmptyRow(rid, nextNumber)];
    });
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load the roster</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  const MEETING_MIN_W = 64;
  const DATE_MIN_W = 140;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        Draft the meeting agenda — assign members, invite guests, and note the theme. The meeting
        number stays pinned on the left as you scroll through the roles.
      </p>

      <div className="rounded-2xl border border-line bg-canvas shadow-sm">
        {/* Both axes scroll inside this container so `position: sticky` on
         * headers and left columns scopes to a single, predictable element. */}
        <div className="max-h-[calc(100dvh-320px)] min-h-[420px] overflow-auto rounded-2xl">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-40 h-9 border-b border-r border-line-strong bg-sidebar px-3 text-left align-middle text-xs font-medium text-ink"
                  style={{ minWidth: MEETING_MIN_W }}
                >
                  Meeting No.
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-30 h-9 border-b border-line bg-sidebar px-3 text-left align-middle text-xs font-medium text-ink"
                  style={{ minWidth: DATE_MIN_W }}
                >
                  Date &amp; Time
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-30 h-9 border-b border-line bg-sidebar px-3 text-left align-middle text-xs font-medium text-ink"
                  style={{ minWidth: TMOD_COLUMN.minWidth }}
                >
                  TMOD
                </th>
                {GROUPED_ASSIGNEE_COLUMNS.map((col) => (
                  <th
                    key={col.field}
                    scope="col"
                    className={`sticky top-0 z-30 h-9 border-b border-line px-3 text-left align-middle text-xs font-medium ${subHeaderGroupClass(col.tint)}`}
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.label}
                  </th>
                ))}
                <th
                  scope="col"
                  className="sticky top-0 z-30 h-9 border-b border-line bg-sidebar px-3 text-left align-middle text-xs font-medium text-ink"
                  style={{ minWidth: 220 }}
                >
                  Theme
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-30 h-9 border-b border-line bg-sidebar px-3 text-left align-middle text-xs font-medium text-ink"
                  style={{ minWidth: 240 }}
                >
                  Notes
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-30 h-9 border-b border-line bg-sidebar px-3 text-center align-middle text-xs font-medium text-ink"
                  style={{ minWidth: 72 }}
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={ALL_ASSIGNEE_COLUMNS.length + 5}
                    className="border-b border-line px-4 py-10 text-center text-sm text-ink-muted"
                  >
                    Loading roster…
                  </td>
                </tr>
              ) : null}

              {rows.map((row, idx) => {
                const currMonth = monthKey(row.dateTime);
                const prevMonth = idx > 0 ? monthKey(rows[idx - 1].dateTime) : null;
                const showMonthDivider = currMonth !== null && currMonth !== prevMonth;
                return (
                  <Fragment key={row.id}>
                    {showMonthDivider ? (
                      <tr>
                        <td
                          colSpan={ALL_ASSIGNEE_COLUMNS.length + 5}
                          className="border-b border-line bg-sidebar p-0"
                        >
                          <div className="sticky left-0 flex w-fit items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                            <CalendarBlank size={12} weight="bold" />
                            {monthLabel(row.dateTime as string)}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    <tr className="group">
                      <td
                        className="sticky left-0 z-20 border-b border-r border-line-strong bg-sidebar px-3 py-1.5 align-middle text-sm font-medium text-ink group-hover:bg-fill/70"
                        style={{ minWidth: MEETING_MIN_W }}
                      >
                        #{row.meetingNumber}
                      </td>
                      <td
                        className="border-b border-line bg-canvas px-1.5 py-1 align-middle group-hover:bg-fill/30"
                        style={{ minWidth: DATE_MIN_W }}
                      >
                        <input
                          type="datetime-local"
                          className="w-full rounded bg-transparent px-1.5 py-1 text-xs text-ink outline-none transition-colors focus:bg-canvas"
                          value={row.dateTime ?? ''}
                          onChange={(event) =>
                            updateRow(row.id, { dateTime: event.target.value || null })
                          }
                          aria-label={`Date and time for meeting #${row.meetingNumber}`}
                        />
                      </td>

                      {ALL_ASSIGNEE_COLUMNS.map((col) => (
                        <td
                          key={col.field}
                          className="border-b border-line bg-canvas px-1.5 py-1 align-middle group-hover:bg-fill/30"
                          style={{ minWidth: col.minWidth }}
                        >
                          <AssigneeSelect
                            value={row[col.field] as Assignee | null}
                            onChange={(next) => updateAssignee(row.id, col.field, next)}
                            members={members}
                            placeholder={col.label}
                            ariaLabel={`${col.label} for meeting #${row.meetingNumber}`}
                          />
                        </td>
                      ))}

                      <td
                        className="border-b border-line bg-canvas px-1.5 py-1 align-middle group-hover:bg-fill/30"
                        style={{ minWidth: 220 }}
                      >
                        <Input
                          variant="borderless"
                          size="small"
                          placeholder="Meeting theme…"
                          value={row.theme}
                          onChange={(event) => updateRow(row.id, { theme: event.target.value })}
                          aria-label={`Theme for meeting #${row.meetingNumber}`}
                        />
                      </td>
                      <td
                        className="border-b border-line bg-canvas px-1.5 py-1 align-middle group-hover:bg-fill/30"
                        style={{ minWidth: 240 }}
                      >
                        <Input
                          variant="borderless"
                          size="small"
                          placeholder="Anything to remember…"
                          value={row.notes}
                          onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                          aria-label={`Notes for meeting #${row.meetingNumber}`}
                        />
                      </td>
                      <td
                        className="border-b border-line bg-canvas px-1 py-1 text-center align-middle group-hover:bg-fill/30"
                        style={{ minWidth: 72 }}
                      >
                        <Button
                          type="text"
                          size="small"
                          shape="circle"
                          disabled
                          aria-label="Row actions — coming soon"
                          icon={<DotsThreeOutline size={16} className="text-ink-muted" />}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-sidebar/60 px-3 py-2">
          <span className="text-xs text-ink-muted">
            {rows.length} {rows.length === 1 ? 'meeting' : 'meetings'} planned
          </span>
          <Button type="text" size="small" onClick={addRow} icon={<Plus size={14} weight="bold" />}>
            Add meeting
          </Button>
        </div>
      </div>
    </div>
  );
}
