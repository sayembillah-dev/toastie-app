'use client';

import {
  CalendarBlank,
  CalendarPlus,
  CheckCircle,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Input, Popconfirm, Skeleton, Tooltip } from 'antd';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import { PlannerCreateMeetingModal } from '@/components/education/planner-create-meeting-modal';
import type { Assignee, AssigneeField, PlannerRow } from '@/lib/education/planner';
import { fromPlannerRowWire, plannerRowLabel, toAssigneesJson } from '@/lib/education/planner';
import {
  useCreatePlannerRowMutation,
  useDeletePlannerRowMutation,
  useGetMeetingsQuery,
  useGetMembersQuery,
  useGetPlannerRowsQuery,
  useUpdatePlannerRowMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/* -----------------------------------------------------------------------------
 * Column config
 * The table renders many similar cells, so a small config drives both the
 * header sub-row and every body row. Widths, labels and group tints live here.
 * -------------------------------------------------------------------------- */

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

/* -----------------------------------------------------------------------------
 * PlannerTab
 * -------------------------------------------------------------------------- */

export function PlannerTab() {
  const { message } = App.useApp();
  const { data: members = [], isLoading: membersLoading, isError, error } = useGetMembersQuery();
  const { data: meetings = [] } = useGetMeetingsQuery();
  const {
    data: rowsData,
    isLoading: rowsLoading,
    isError: rowsError,
    error: rowsErrorDetail,
  } = useGetPlannerRowsQuery();

  const [createRow, { isLoading: isCreatingRow }] = useCreatePlannerRowMutation();
  const [updateRow] = useUpdatePlannerRowMutation();
  const [deleteRowMutation] = useDeletePlannerRowMutation();

  const rows = useMemo(() => (rowsData ?? []).map(fromPlannerRowWire), [rowsData]);

  /* The row the create dialog is reviewing. `open` is tracked separately from
   * the row so the dialog keeps its content while it animates away — the row is
   * only dropped once it has gone. */
  const [createDialog, setCreateDialog] = useState<{ row: PlannerRow | null; open: boolean }>({
    row: null,
    open: false,
  });

  /* The row's own `meetingId` is the join now — set once "Create meeting"
   * succeeds — rather than matching on the typed-in meeting number. */
  const meetingById = useMemo(
    () => new Map(meetings.map((meeting) => [meeting.id, meeting])),
    [meetings],
  );

  function findCreated(row: PlannerRow) {
    return row.meetingId ? meetingById.get(row.meetingId) : undefined;
  }

  function patchRow(
    id: string,
    patch: Partial<Pick<PlannerRow, 'meetingNumber' | 'dateTime' | 'theme' | 'notes'>>,
  ) {
    updateRow({ rowId: id, ...patch })
      .unwrap()
      .catch((err) => message.error(getApiErrorMessage(err, 'Could not save the change')));
  }

  function updateAssignee(id: string, field: AssigneeField, next: Assignee | null) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const assignees = toAssigneesJson({ ...row, [field]: next });
    updateRow({ rowId: id, assignees })
      .unwrap()
      .catch((err) => message.error(getApiErrorMessage(err, 'Could not save the change')));
  }

  async function addRow() {
    try {
      await createRow().unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not add the row'));
    }
  }

  async function deleteRow(id: string) {
    try {
      await deleteRowMutation({ rowId: id }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the row'));
    }
  }

  if (isError || rowsError) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load the planner</p>
        <p className="mt-1 text-xs text-ink-muted">
          {getApiErrorMessage(error ?? rowsErrorDetail)}
        </p>
      </div>
    );
  }

  const isLoading = membersLoading || rowsLoading;

  const MEETING_MIN_W = 96;
  const DATE_MIN_W = 140;
  const ACTION_MIN_W = 96;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        Draft the meeting agenda — assign members, invite guests, and note the theme. The meeting
        number stays pinned on the left as you scroll through the roles. Rows shaded{' '}
        <span className="font-medium text-emerald-700">green</span> already exist as meetings.
      </p>

      <div className="rounded-2xl border border-line bg-canvas shadow-sm">
        {isLoading && rows.length === 0 ? (
          <div className="p-4 sm:p-6">
            <Skeleton active title={false} paragraph={{ rows: 4 }} />
          </div>
        ) : (
          <>
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
                      style={{ minWidth: ACTION_MIN_W }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={ALL_ASSIGNEE_COLUMNS.length + 5}
                        className="border-b border-line px-4 py-10 text-center text-sm text-ink-muted"
                      >
                        No meetings planned yet — use &ldquo;Add meeting&rdquo; below to start a
                        row.
                      </td>
                    </tr>
                  ) : null}

                  {rows.map((row, idx) => {
                    const currMonth = monthKey(row.dateTime);
                    const prevMonth = idx > 0 ? monthKey(rows[idx - 1].dateTime) : null;
                    const showMonthDivider = currMonth !== null && currMonth !== prevMonth;
                    const created = findCreated(row);
                    const rowLabel = plannerRowLabel(row);
                    /* Tailwind needs literal class strings, so the created and
                     * pending tints are spelled out rather than composed. */
                    const cellClass = created
                      ? 'bg-emerald-50/70 group-hover:bg-emerald-50'
                      : 'bg-canvas group-hover:bg-fill/30';
                    const stickyCellClass = created
                      ? 'bg-emerald-50 group-hover:bg-emerald-100/70'
                      : 'bg-sidebar group-hover:bg-fill/70';
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
                            className={`sticky left-0 z-20 border-b border-r border-line-strong px-2 py-1.5 align-middle text-sm font-medium text-ink ${stickyCellClass}`}
                            style={{ minWidth: MEETING_MIN_W }}
                          >
                            {/* Typed in, never derived — clubs number their
                             * meetings on their own scheme, and this number is what
                             * ties the row to a created meeting. */}
                            <span className="flex items-center gap-1">
                              <span aria-hidden className="text-ink-muted">
                                #
                              </span>
                              <input
                                type="number"
                                min={1}
                                step={1}
                                placeholder="No."
                                className="w-14 rounded bg-transparent px-1 py-1 text-sm text-ink outline-none transition-colors focus:bg-canvas"
                                value={row.meetingNumber ?? ''}
                                onChange={(event) =>
                                  patchRow(row.id, {
                                    meetingNumber:
                                      event.target.value === '' ? null : Number(event.target.value),
                                  })
                                }
                                aria-label={`Meeting number for ${rowLabel}`}
                              />
                            </span>
                          </td>
                          <td
                            className={`border-b border-line px-1.5 py-1 align-middle ${cellClass}`}
                            style={{ minWidth: DATE_MIN_W }}
                          >
                            <input
                              type="datetime-local"
                              className="w-full rounded bg-transparent px-1.5 py-1 text-xs text-ink outline-none transition-colors focus:bg-canvas"
                              value={row.dateTime ?? ''}
                              onChange={(event) =>
                                patchRow(row.id, { dateTime: event.target.value || null })
                              }
                              aria-label={`Date and time for ${rowLabel}`}
                            />
                          </td>

                          {ALL_ASSIGNEE_COLUMNS.map((col) => (
                            <td
                              key={col.field}
                              className={`border-b border-line px-1.5 py-1 align-middle ${cellClass}`}
                              style={{ minWidth: col.minWidth }}
                            >
                              <AssigneeSelect
                                value={row[col.field] as Assignee | null}
                                onChange={(next) => updateAssignee(row.id, col.field, next)}
                                members={members}
                                placeholder={col.label}
                                ariaLabel={`${col.label} for ${rowLabel}`}
                              />
                            </td>
                          ))}

                          <td
                            className={`border-b border-line px-1.5 py-1 align-middle ${cellClass}`}
                            style={{ minWidth: 220 }}
                          >
                            <Input
                              variant="borderless"
                              size="small"
                              placeholder="Meeting theme…"
                              value={row.theme}
                              onChange={(event) => patchRow(row.id, { theme: event.target.value })}
                              aria-label={`Theme for ${rowLabel}`}
                            />
                          </td>
                          <td
                            className={`border-b border-line px-1.5 py-1 align-middle ${cellClass}`}
                            style={{ minWidth: 240 }}
                          >
                            <Input
                              variant="borderless"
                              size="small"
                              placeholder="Anything to remember…"
                              value={row.notes}
                              onChange={(event) => patchRow(row.id, { notes: event.target.value })}
                              aria-label={`Notes for ${rowLabel}`}
                            />
                          </td>
                          <td
                            className={`border-b border-line px-1 py-1 text-center align-middle ${cellClass}`}
                            style={{ minWidth: ACTION_MIN_W }}
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              {created ? (
                                /* Already a meeting — the row's job here is done, so
                                 * the slot becomes a way back to it. */
                                <Tooltip title={`Created · open meeting #${created.meetingNumber}`}>
                                  <Link
                                    href={`/meetings/${created.id}`}
                                    aria-label={`Open the meeting created from ${rowLabel}`}
                                    className="inline-flex size-6 items-center justify-center rounded-full text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                                  >
                                    <CheckCircle size={16} weight="fill" />
                                  </Link>
                                </Tooltip>
                              ) : (
                                <Tooltip title="Create meeting from this row">
                                  <Button
                                    type="text"
                                    size="small"
                                    shape="circle"
                                    onClick={() => setCreateDialog({ row, open: true })}
                                    aria-label={`Create a meeting from ${rowLabel}`}
                                    icon={<CalendarPlus size={16} className="text-ink-soft" />}
                                  />
                                </Tooltip>
                              )}

                              <Popconfirm
                                title="Delete this row?"
                                description={
                                  created
                                    ? 'The meeting created from it stays on the Meetings page.'
                                    : 'Everything assigned on the row is lost.'
                                }
                                okText="Delete"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                                onConfirm={() => deleteRow(row.id)}
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  shape="circle"
                                  danger
                                  aria-label={`Delete ${rowLabel} from the planner`}
                                  icon={<Trash size={16} />}
                                />
                              </Popconfirm>
                            </div>
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
              <Button
                type="text"
                size="small"
                loading={isCreatingRow}
                onClick={addRow}
                icon={<Plus size={14} weight="bold" />}
              >
                Add meeting
              </Button>
            </div>
          </>
        )}
      </div>

      <PlannerCreateMeetingModal
        open={createDialog.open}
        row={createDialog.row}
        members={members}
        onClose={() => setCreateDialog((prev) => ({ ...prev, open: false }))}
        onClosed={() => setCreateDialog({ row: null, open: false })}
      />
    </div>
  );
}
