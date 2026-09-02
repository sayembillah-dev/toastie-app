'use client';

import {
  CalendarBlank,
  CalendarPlus,
  CheckCircle,
  Flag,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, DatePicker, Input, Popconfirm, Skeleton, Tooltip } from 'antd';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { AssigneeSelect } from '@/components/education/assignee-select';
import { PlannerCreateMeetingModal } from '@/components/meetings/planner-create-meeting-modal';
import { PlannerMobile } from '@/components/meetings/planner-mobile';
import { ReadOnly } from '@/components/permissions/read-only';
import dayjs from '@/lib/dayjs';
import type { Member } from '@/lib/education/members';
import type { Assignee, AssigneeField, PlannerRow } from '@/lib/education/planner';
import {
  ASSIGNEE_FIELD_LABELS,
  assigneeKey,
  assigneeLabel,
  fromPlannerRowWire,
  plannerRowLabel,
  toAssigneesJson,
} from '@/lib/education/planner';
import { localMonthKey, localMonthLabel } from '@/lib/meetings/datetime';
import type { Meeting } from '@/lib/meetings/meetings';
import type { Guest } from '@/lib/people/guests';
import { useIsMobile } from '@/lib/ui/use-is-mobile';
import { useBlurCommit } from '@/lib/use-blur-commit';
import {
  useCreatePlannerRowMutation,
  useDeletePlannerRowMutation,
  useGetGuestsQuery,
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

type Tint = 'none' | 'amber' | 'blue' | 'violet' | 'teal' | 'rose' | 'slate';

interface AssigneeCol {
  field: AssigneeField;
  minWidth: number;
  tint: Tint;
}

const TMOD_COLUMN: AssigneeCol = { field: 'tmod', minWidth: 200, tint: 'none' };

/** Every column that lives inside a visual group. Order matters — it drives
 * the sub-header row and every tbody row's cell order. Labels come from
 * `ASSIGNEE_FIELD_LABELS` so the desktop grid and the mobile cards can
 * never drift apart on a rename. */
const GROUPED_ASSIGNEE_COLUMNS: AssigneeCol[] = [
  { field: 'ttm', minWidth: 200, tint: 'amber' },
  { field: 'ttEvaluator', minWidth: 200, tint: 'amber' },
  { field: 'speaker1', minWidth: 200, tint: 'blue' },
  { field: 'evaluator1', minWidth: 200, tint: 'blue' },
  { field: 'speaker2', minWidth: 200, tint: 'violet' },
  { field: 'evaluator2', minWidth: 200, tint: 'violet' },
  { field: 'speaker3', minWidth: 200, tint: 'teal' },
  { field: 'evaluator3', minWidth: 200, tint: 'teal' },
  { field: 'speaker4', minWidth: 200, tint: 'rose' },
  { field: 'evaluator4', minWidth: 200, tint: 'rose' },
  { field: 'generalEvaluator', minWidth: 200, tint: 'slate' },
  { field: 'timer', minWidth: 170, tint: 'slate' },
  { field: 'ahCounter', minWidth: 170, tint: 'slate' },
  { field: 'grammarian', minWidth: 200, tint: 'slate' },
  { field: 'harkmaster', minWidth: 200, tint: 'slate' },
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
    case 'rose':
      return 'bg-rose-50/60 text-ink';
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

/* `dateTime` is a stored instant, so the month has to be read off the viewer's
 * local clock — slicing the ISO string would group by UTC month and file a
 * late-evening meeting on the 31st under the following month. */
const monthKey = localMonthKey;

const MEETING_MIN_W = 96;
const DATE_MIN_W = 190;
const ACTION_MIN_W = 96;

/* -----------------------------------------------------------------------------
 * PlannerTableRow
 * Broken out from PlannerScreen so each row's fields can hold independent
 * useBlurCommit state — hooks can't live inside a .map() callback.
 * -------------------------------------------------------------------------- */

interface PlannerTableRowProps {
  row: PlannerRow;
  rowLabel: string;
  monthDividerLabel: string | null;
  created: Meeting | undefined;
  /** The row that sits immediately before this one on the calendar (largest
   * dateTime that's still less than this row's). Drives the same-role
   * repeat-flag — `undefined` when this row has no prior meeting to compare
   * against. */
  previousRow: PlannerRow | undefined;
  members: Member[];
  guests: Guest[];
  patchRow: (
    id: string,
    patch: Partial<Pick<PlannerRow, 'meetingNumber' | 'dateTime' | 'theme' | 'notes'>>,
  ) => void;
  updateAssignee: (id: string, field: AssigneeField, next: Assignee | null) => void;
  onCreateMeeting: () => void;
  onDelete: () => void;
}

function PlannerTableRow({
  row,
  rowLabel,
  monthDividerLabel,
  created,
  previousRow,
  members,
  guests,
  patchRow,
  updateAssignee,
  onCreateMeeting,
  onDelete,
}: PlannerTableRowProps) {
  const meetingNumberField = useBlurCommit(row.meetingNumber, (next) =>
    patchRow(row.id, { meetingNumber: next }),
  );
  const themeField = useBlurCommit(row.theme, (next) => patchRow(row.id, { theme: next }));
  const notesField = useBlurCommit(row.notes, (next) => patchRow(row.id, { notes: next }));

  /* Tailwind needs literal class strings, so the created and pending tints
   * are spelled out rather than composed. */
  const cellClass = created
    ? 'bg-emerald-50/70 group-hover:bg-emerald-50'
    : 'bg-canvas group-hover:bg-fill/30';
  const stickyCellClass = created
    ? 'bg-emerald-50 group-hover:bg-emerald-100/70'
    : 'bg-sidebar group-hover:bg-fill/70';

  return (
    <Fragment>
      {monthDividerLabel !== null ? (
        <tr>
          <td
            colSpan={ALL_ASSIGNEE_COLUMNS.length + 5}
            className="border-b border-line bg-sidebar p-0"
          >
            <div className="sticky left-0 flex w-fit items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <CalendarBlank size={12} weight="bold" />
              {monthDividerLabel}
            </div>
          </td>
        </tr>
      ) : null}
      <tr className="group">
        <td
          className={`sticky left-0 z-20 border-b border-r border-line-strong px-2 py-1.5 align-middle text-sm font-medium text-ink ${stickyCellClass}`}
          style={{ minWidth: MEETING_MIN_W }}
        >
          {/* Typed in, never derived — clubs number their meetings on their
           * own scheme, and this number is what ties the row to a created
           * meeting. */}
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
              value={meetingNumberField.value ?? ''}
              onChange={(event) =>
                meetingNumberField.onChange(
                  event.target.value === '' ? null : Number(event.target.value),
                )
              }
              onFocus={meetingNumberField.onFocus}
              onBlur={meetingNumberField.onBlur}
              aria-label={`Meeting number for ${rowLabel}`}
            />
          </span>
        </td>
        <td
          className={`border-b border-line px-1.5 py-1 align-middle ${cellClass}`}
          style={{ minWidth: DATE_MIN_W }}
        >
          <DatePicker
            variant="borderless"
            className="w-full"
            size="small"
            showTime={{ format: 'h:mm A', minuteStep: 5, use12Hours: true }}
            format="D MMM YYYY, h:mm A"
            value={row.dateTime ? dayjs(row.dateTime) : null}
            /* Stored as an instant, shown local — the picker is already
               working in local time, so `toISOString` is the whole
               conversion. */
            onChange={(value) =>
              patchRow(row.id, {
                dateTime: value ? value.second(0).millisecond(0).toISOString() : null,
              })
            }
            aria-label={`Date and time for ${rowLabel}`}
          />
        </td>

        {ALL_ASSIGNEE_COLUMNS.map((col) => {
          const currAssignee = row[col.field] as Assignee | null;
          const prevAssignee = (previousRow?.[col.field] as Assignee | null | undefined) ?? null;
          const currKey = assigneeKey(currAssignee);
          /* A cell only clashes when both meetings hold the slot and the same
           * person fills both — empty slots and different people leave it
           * alone. */
          const isRepeatFromPrev = currKey !== null && currKey === assigneeKey(prevAssignee);
          const cellFinalClass = isRepeatFromPrev
            ? 'bg-rose-50/70 group-hover:bg-rose-100/70'
            : cellClass;
          const conflictTooltip = isRepeatFromPrev
            ? `${assigneeLabel(currAssignee, members)} was ${ASSIGNEE_FIELD_LABELS[col.field]} in the previous meeting.`
            : '';
          return (
            <td
              key={col.field}
              className={`relative border-b border-line px-1.5 py-1 align-middle ${cellFinalClass}`}
              style={{ minWidth: col.minWidth }}
            >
              {isRepeatFromPrev ? (
                <Tooltip title={conflictTooltip}>
                  <span
                    role="img"
                    aria-label={conflictTooltip}
                    className="absolute left-0 top-0 z-10 inline-flex cursor-help items-center justify-center rounded-br-md bg-rose-100 px-1 py-0.5 text-rose-600"
                  >
                    <Flag size={10} weight="fill" />
                  </span>
                </Tooltip>
              ) : null}
              <AssigneeSelect
                value={currAssignee}
                onChange={(next) => updateAssignee(row.id, col.field, next)}
                members={members}
                guests={guests}
                placeholder={ASSIGNEE_FIELD_LABELS[col.field]}
                ariaLabel={`${ASSIGNEE_FIELD_LABELS[col.field]} for ${rowLabel}`}
              />
            </td>
          );
        })}

        <td
          className={`border-b border-line px-1.5 py-1 align-middle ${cellClass}`}
          style={{ minWidth: 220 }}
        >
          <Input
            variant="borderless"
            size="small"
            placeholder="Meeting theme…"
            value={themeField.value}
            onChange={(event) => themeField.onChange(event.target.value)}
            onFocus={themeField.onFocus}
            onBlur={themeField.onBlur}
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
            value={notesField.value}
            onChange={(event) => notesField.onChange(event.target.value)}
            onFocus={notesField.onFocus}
            onBlur={notesField.onBlur}
            aria-label={`Notes for ${rowLabel}`}
          />
        </td>
        <td
          className={`sticky right-0 z-20 border-b border-l border-line-strong px-1 py-1 text-center align-middle ${stickyCellClass}`}
          style={{ minWidth: ACTION_MIN_W }}
        >
          <div className="flex items-center justify-center gap-0.5">
            {created ? (
              /* Already a meeting — the row's job here is done, so the slot
               * becomes a way back to it. */
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
                  onClick={onCreateMeeting}
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
              onConfirm={onDelete}
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
}

/* -----------------------------------------------------------------------------
 * PlannerScreen
 * -------------------------------------------------------------------------- */

/** Meetings > Planner — the term planner as its own page. Reached from the
 * "Planner" button on the Meetings header; a row here becomes a real meeting
 * via `PlannerCreateMeetingModal`. */
export function PlannerScreen() {
  const { message } = App.useApp();
  const { data: members = [], isLoading: membersLoading, isError, error } = useGetMembersQuery();
  const { data: guests = [] } = useGetGuestsQuery();
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

  /* The 16-column grid can't work on a phone, so below `md` the same data
   * renders as per-meeting cards with a role lens (see planner-mobile.tsx).
   * All queries, mutations and dialog state stay here — the fork is
   * presentation-only. Hooked up here, before the error return, so the
   * hook order never changes. */
  const isMobile = useIsMobile();

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

  /* Row id → the row that sits immediately before it on the calendar. Rows
   * without a dateTime don't have a chronological position, so they neither
   * appear in nor point at anything in this map. Drives the same-role
   * repeat-flag in every assignee cell. */
  const previousRowById = useMemo(() => {
    const dated = rows.filter((r): r is PlannerRow & { dateTime: string } => r.dateTime !== null);
    /* Compared as instants rather than as strings: the stored values are
     * ISO timestamps, and lexical order only happens to match chronological
     * order while every one of them carries the same offset. */
    const sorted = [...dated].sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
    );
    const map = new Map<string, PlannerRow>();
    for (let i = 1; i < sorted.length; i++) {
      map.set(sorted[i].id, sorted[i - 1]);
    }
    return map;
  }, [rows]);

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

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Planner</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Draft the meeting agenda a term at a time — then spin a row up into a real meeting when
          it&apos;s set.
        </p>
      </header>

      {/* Breakpoint not resolved yet (server / first client frame) — show a
       * placeholder rather than guessing a layout. */}
      {isMobile === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-fill" />
          <div className="h-72 animate-pulse rounded-2xl bg-fill" />
        </div>
      ) : isMobile ? (
        <PlannerMobile
          rows={rows}
          isLoading={isLoading}
          isCreatingRow={isCreatingRow}
          members={members}
          guests={guests}
          findCreated={findCreated}
          previousRowById={previousRowById}
          addRow={addRow}
          patchRow={patchRow}
          updateAssignee={updateAssignee}
          deleteRow={deleteRow}
          onCreateMeeting={(row) => setCreateDialog({ row, open: true })}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            Assign members, invite guests, and note the theme. The meeting number stays pinned on
            the left as you scroll through the roles. Rows shaded{' '}
            <span className="font-medium text-emerald-700">green</span> already exist as meetings.
          </p>

          <div className="rounded-2xl border border-line bg-canvas shadow-sm">
            {isLoading && rows.length === 0 ? (
              <div className="p-4 sm:p-6">
                <Skeleton active title={false} paragraph={{ rows: 4 }} />
              </div>
            ) : (
              <ReadOnly resource="education" display="block">
                {/* Both axes scroll inside this container so `position: sticky` on
                 * headers and left columns scopes to a single, predictable element. */}
                <div className="max-h-[calc(100dvh-274px)] min-h-[420px] overflow-auto rounded-2xl">
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
                          {ASSIGNEE_FIELD_LABELS.tmod}
                        </th>
                        {GROUPED_ASSIGNEE_COLUMNS.map((col) => (
                          <th
                            key={col.field}
                            scope="col"
                            className={`sticky top-0 z-30 h-9 border-b border-line px-3 text-left align-middle text-xs font-medium ${subHeaderGroupClass(col.tint)}`}
                            style={{ minWidth: col.minWidth }}
                          >
                            {ASSIGNEE_FIELD_LABELS[col.field]}
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
                          className="sticky right-0 top-0 z-40 h-9 border-b border-l border-line-strong bg-sidebar px-3 text-center align-middle text-xs font-medium text-ink"
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
                        const monthDividerLabel =
                          currMonth !== null && currMonth !== prevMonth
                            ? localMonthLabel(row.dateTime as string)
                            : null;
                        return (
                          <PlannerTableRow
                            key={row.id}
                            row={row}
                            rowLabel={plannerRowLabel(row)}
                            monthDividerLabel={monthDividerLabel}
                            created={findCreated(row)}
                            previousRow={previousRowById.get(row.id)}
                            members={members}
                            guests={guests}
                            patchRow={patchRow}
                            updateAssignee={updateAssignee}
                            onCreateMeeting={() => setCreateDialog({ row, open: true })}
                            onDelete={() => deleteRow(row.id)}
                          />
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
              </ReadOnly>
            )}
          </div>
        </div>
      )}

      {/* Shared by both layouts — the mobile cards open it from their own
       * overflow menu, so it lives outside the fork. */}
      <PlannerCreateMeetingModal
        open={createDialog.open}
        row={createDialog.row}
        members={members}
        guests={guests}
        onClose={() => setCreateDialog((prev) => ({ ...prev, open: false }))}
        onClosed={() => setCreateDialog({ row: null, open: false })}
      />
    </div>
  );
}
