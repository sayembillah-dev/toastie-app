'use client';

import {
  CalendarBlank,
  CalendarPlus,
  CheckCircle,
  DotsThreeVertical,
  Flag,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Dropdown,
  Input,
  InputNumber,
  type MenuProps,
} from 'antd';
import Link from 'next/link';
import { Fragment, useState } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import { ReadOnly } from '@/components/permissions/read-only';
import dayjs, { type Dayjs } from '@/lib/dayjs';
import type { Member } from '@/lib/education/members';
import type { Assignee, AssigneeField, PlannerRow } from '@/lib/education/planner';
import {
  ASSIGNEE_FIELD_LABELS,
  assigneeKey,
  assigneeLabel,
  plannerRowLabel,
} from '@/lib/education/planner';
import { localMonthKey, localMonthLabel } from '@/lib/meetings/datetime';
import type { Meeting } from '@/lib/meetings/meetings';
import type { Guest } from '@/lib/people/guests';
import { useCan } from '@/lib/permissions/use-can';

/* -----------------------------------------------------------------------------
 * PlannerMobile — the planner as per-meeting cards instead of the 16-column
 * grid (which can't work on a phone). Presentation-only: planner-screen.tsx
 * owns every query, mutation and the create-meeting dialog; this file renders
 * what it's handed and reports taps back through props.
 *
 * Two ways to scan:
 *  1. "All roles" — each card is one meeting with every role row inside.
 *  2. A role lens — the chip strip collapses every card to one slice (e.g.
 *     just TMOD, or the four speaker slots), giving back the term-wide
 *     "column" view the horizontal scroll never could on a phone.
 * -------------------------------------------------------------------------- */

/* `dateTime` is a stored instant, so the month has to be read off the viewer's
 * local clock — same reasoning as the desktop grid. */
const monthKey = localMonthKey;

const CARD_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const CARD_TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
});

/** The card's own name for a row — plannerRowLabel's lowercase phrasing is
 * written for sentences ("this planned meeting"), the card needs a title. */
function cardTitle(row: PlannerRow): string {
  return row.meetingNumber === null ? 'Planned meeting' : `Meeting #${row.meetingNumber}`;
}

function cardDateLine(row: PlannerRow): string {
  if (!row.dateTime) return 'No date set';
  const date = new Date(row.dateTime);
  return `${CARD_DATE_FMT.format(date)} · ${CARD_TIME_FMT.format(date)}`;
}

/* -----------------------------------------------------------------------------
 * Role lenses
 * -------------------------------------------------------------------------- */

/** Full-card role order — matches the desktop grid's column order exactly. */
const ALL_FIELDS_IN_ORDER: AssigneeField[] = [
  'tmod',
  'ttm',
  'ttEvaluator',
  'speaker1',
  'evaluator1',
  'speaker2',
  'evaluator2',
  'speaker3',
  'evaluator3',
  'speaker4',
  'evaluator4',
  'generalEvaluator',
  'timer',
  'ahCounter',
  'grammarian',
  'harkmaster',
];

interface Lens {
  id: string;
  label: string;
  fields: AssigneeField[];
}

/** The chip strip. Speakers/evaluators group their four slots each — a single
 * "Speaker 2" lens would be too narrow to be useful, and the desktop grid
 * visually groups them the same way. */
const LENSES: Lens[] = [
  { id: 'all', label: 'All roles', fields: ALL_FIELDS_IN_ORDER },
  { id: 'tmod', label: 'TMOD', fields: ['tmod'] },
  { id: 'topics', label: 'Table Topics', fields: ['ttm', 'ttEvaluator'] },
  { id: 'speakers', label: 'Speakers', fields: ['speaker1', 'speaker2', 'speaker3', 'speaker4'] },
  {
    id: 'evaluators',
    label: 'Evaluators',
    fields: ['evaluator1', 'evaluator2', 'evaluator3', 'evaluator4'],
  },
  { id: 'ge', label: 'Gen. Evaluator', fields: ['generalEvaluator'] },
  { id: 'timer', label: 'Timer', fields: ['timer'] },
  { id: 'ahCounter', label: 'Ah-counter', fields: ['ahCounter'] },
  { id: 'grammarian', label: 'Grammarian', fields: ['grammarian'] },
  { id: 'harkmaster', label: 'Harkmaster', fields: ['harkmaster'] },
];

/* -----------------------------------------------------------------------------
 * Props
 * -------------------------------------------------------------------------- */

export interface PlannerMobileProps {
  rows: PlannerRow[];
  /** Initial-load flag — with rows already on screen a background refetch
   * leaves the cards alone, same as the desktop grid. */
  isLoading: boolean;
  isCreatingRow: boolean;
  members: Member[];
  guests: Guest[];
  findCreated: (row: PlannerRow) => Meeting | undefined;
  /** Row id → the dated row immediately before it on the calendar — drives
   * the same-role repeat flag on the cards and in the assign sheet. */
  previousRowById: Map<string, PlannerRow>;
  addRow: () => void;
  patchRow: (
    id: string,
    patch: Partial<Pick<PlannerRow, 'meetingNumber' | 'dateTime' | 'theme' | 'notes'>>,
  ) => void;
  updateAssignee: (id: string, field: AssigneeField, next: Assignee | null) => void;
  deleteRow: (id: string) => void;
  /** Opens the create-meeting dialog owned by planner-screen. */
  onCreateMeeting: (row: PlannerRow) => void;
}

/* Keep the sheet's target separate from `open` — the Drawer keeps its content
 * while it animates away, so the row/field are only dropped once it's gone
 * (same pattern as the screen's own create dialog). */
interface SheetState<T> {
  target: T | null;
  open: boolean;
}

interface AssignTarget {
  row: PlannerRow;
  field: AssigneeField;
}

export function PlannerMobile({
  rows,
  isLoading,
  isCreatingRow,
  members,
  guests,
  findCreated,
  previousRowById,
  addRow,
  patchRow,
  updateAssignee,
  deleteRow,
  onCreateMeeting,
}: PlannerMobileProps) {
  const { modal } = App.useApp();
  /* ReadOnly (below) greys every antd control in the subtree, but the role
   * rows, overflow trigger and FAB are plain HTML — outside ConfigProvider's
   * reach — so they gate on the same boolean directly. */
  const { can } = useCan();
  const canWrite = can('update', 'education');

  const [lensId, setLensId] = useState('all');
  const lens = LENSES.find((entry) => entry.id === lensId) ?? LENSES[0];

  const [assignSheet, setAssignSheet] = useState<SheetState<AssignTarget>>({
    target: null,
    open: false,
  });
  const [detailsSheet, setDetailsSheet] = useState<SheetState<PlannerRow>>({
    target: null,
    open: false,
  });

  const confirmDelete = (row: PlannerRow) => {
    modal.confirm({
      title: 'Delete this row?',
      icon: <WarningCircle size={20} weight="fill" className="text-rose-600" />,
      content: (
        <p className="text-sm text-ink-soft">
          {findCreated(row)
            ? 'The meeting created from it stays on the Meetings page.'
            : 'Everything assigned on the row is lost.'}
        </p>
      ),
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: () => deleteRow(row.id),
    });
  };

  const sheetOpen = assignSheet.open || detailsSheet.open;

  return (
    <ReadOnly resource="education" display="block">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-soft">
          Tap a role to fill it, or pick a lens to scan one job across the whole term. Cards shaded{' '}
          <span className="font-medium text-emerald-700">green</span> already exist as meetings.
        </p>

        {/* Lens strip — sticky under the shell header so switching lens never
         * needs a scroll back to the top. `-mx-4` bleeds it to the panel
         * edge (the shell's `main` pads content by 4) so it reads as a bar. */}
        <div className="sticky top-0 z-20 -mx-4 flex h-12 items-center gap-2 overflow-x-auto bg-canvas px-4">
          {LENSES.map((entry) => {
            const active = entry.id === lens.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={active}
                onClick={() => setLensId(entry.id)}
                className={`h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors ${
                  active
                    ? 'border-ink bg-ink text-canvas'
                    : 'border-line bg-canvas text-ink-soft hover:bg-fill'
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-fill" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="text-sm font-medium text-ink">No meetings planned yet</p>
            <p className="mt-1 text-xs text-ink-muted">Tap + below to start the first row.</p>
          </div>
        ) : (
          rows.map((row, idx) => {
            const currMonth = monthKey(row.dateTime);
            const prevMonth = idx > 0 ? monthKey(rows[idx - 1].dateTime) : null;
            const showMonthDivider = currMonth !== null && currMonth !== prevMonth;
            return (
              <Fragment key={row.id}>
                {showMonthDivider ? (
                  /* Sticks just under the 48px lens strip and gets pushed up
                   * by the next month — the term's running context. */
                  <h2 className="sticky top-12 z-10 -mx-4 flex items-center gap-2 bg-canvas px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                    <CalendarBlank size={12} weight="bold" aria-hidden />
                    {localMonthLabel(row.dateTime as string)}
                  </h2>
                ) : null}
                <MeetingCard
                  row={row}
                  fields={lens.fields}
                  created={findCreated(row)}
                  previousRow={previousRowById.get(row.id)}
                  members={members}
                  canWrite={canWrite}
                  onAssign={(field) => setAssignSheet({ target: { row, field }, open: true })}
                  onEditDetails={() => setDetailsSheet({ target: row, open: true })}
                  onCreateMeeting={() => onCreateMeeting(row)}
                  onDelete={() => confirmDelete(row)}
                />
              </Fragment>
            );
          })
        )}

        {/* Clearance so the FAB never sits on top of the last card. */}
        <div className="h-20 shrink-0" aria-hidden="true" />
      </div>

      <AssignSheet
        state={assignSheet}
        members={members}
        guests={guests}
        previousRowById={previousRowById}
        onClose={() => setAssignSheet((prev) => ({ ...prev, open: false }))}
        onClosed={() => setAssignSheet({ target: null, open: false })}
        onCommit={(rowId, field, next) => {
          updateAssignee(rowId, field, next);
          setAssignSheet((prev) => ({ ...prev, open: false }));
        }}
      />

      <DetailsSheet
        state={detailsSheet}
        onClose={() => setDetailsSheet((prev) => ({ ...prev, open: false }))}
        onClosed={() => setDetailsSheet({ target: null, open: false })}
        onCommit={(rowId, patch) => {
          patchRow(rowId, patch);
          setDetailsSheet((prev) => ({ ...prev, open: false }));
        }}
      />

      {/* FAB — hidden while a sheet is up, matching the timer's speed-dial.
       * The wrapper owns the fixed positioning: Tailwind's `fixed` on the
       * Button itself loses to antd's unlayered `.ant-btn { position:
       * relative }` (Tailwind v4 utilities are in a cascade layer). */}
      {sheetOpen ? null : (
        <div
          className="fixed z-40"
          style={{
            right: 'calc(20px + env(safe-area-inset-right))',
            bottom: 'calc(24px + env(safe-area-inset-bottom))',
          }}
        >
          <Button
            type="primary"
            shape="circle"
            aria-label="Add meeting"
            loading={isCreatingRow}
            disabled={!canWrite}
            icon={<Plus size={24} weight="bold" />}
            onClick={addRow}
            style={{
              width: 56,
              height: 56,
              /* antd's unlayered box-shadow beats `shadow-lg`. */
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2)',
            }}
          />
        </div>
      )}
    </ReadOnly>
  );
}

/* -----------------------------------------------------------------------------
 * MeetingCard — one planned meeting: header (number, date, theme, actions)
 * plus one tappable row per role the current lens shows.
 * -------------------------------------------------------------------------- */

interface MeetingCardProps {
  row: PlannerRow;
  /** The lens-filtered role fields to render, in display order. */
  fields: AssigneeField[];
  created: Meeting | undefined;
  previousRow: PlannerRow | undefined;
  members: Member[];
  canWrite: boolean;
  onAssign: (field: AssigneeField) => void;
  onEditDetails: () => void;
  onCreateMeeting: () => void;
  onDelete: () => void;
}

function MeetingCard({
  row,
  fields,
  created,
  previousRow,
  members,
  canWrite,
  onAssign,
  onEditDetails,
  onCreateMeeting,
  onDelete,
}: MeetingCardProps) {
  const menuItems: MenuProps['items'] = [
    ...(created
      ? []
      : [{ key: 'create', icon: <CalendarPlus size={14} />, label: 'Create meeting' }]),
    { key: 'edit', icon: <PencilSimple size={14} />, label: 'Edit details' },
    { type: 'divider' as const },
    { key: 'delete', icon: <Trash size={14} />, label: 'Delete row', danger: true },
  ];

  return (
    <section
      aria-label={plannerRowLabel(row)}
      className={`overflow-hidden rounded-2xl border ${
        created ? 'border-emerald-200 bg-emerald-50/60' : 'border-line bg-canvas'
      }`}
    >
      <header className="flex items-start gap-2 px-4 pb-1 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{cardTitle(row)}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
            <CalendarBlank size={12} aria-hidden />
            {row.dateTime ? (
              <time dateTime={row.dateTime}>{cardDateLine(row)}</time>
            ) : (
              cardDateLine(row)
            )}
          </p>
          {row.theme ? <p className="mt-0.5 truncate text-xs text-ink-soft">{row.theme}</p> : null}
        </div>

        {created ? (
          /* Already a meeting — the card's job is done, so the header gets a
           * way back to it. */
          <Link
            href={`/meetings/${created.id}`}
            aria-label={`Open the meeting created from ${plannerRowLabel(row)}`}
            className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-200/70"
          >
            <CheckCircle size={12} weight="fill" />
            Open
          </Link>
        ) : null}

        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: menuItems,
            onClick: ({ key }) => {
              if (key === 'create') onCreateMeeting();
              else if (key === 'edit') onEditDetails();
              else if (key === 'delete') onDelete();
            },
          }}
        >
          <button
            type="button"
            disabled={!canWrite}
            aria-label={`Actions for ${plannerRowLabel(row)}`}
            aria-haspopup="menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
        </Dropdown>
      </header>

      <ul className="flex flex-col px-1 pb-1.5">
        {fields.map((field) => (
          <RoleRow
            key={field}
            row={row}
            field={field}
            previousRow={previousRow}
            members={members}
            canWrite={canWrite}
            onAssign={() => onAssign(field)}
          />
        ))}
      </ul>
    </section>
  );
}

/* -----------------------------------------------------------------------------
 * RoleRow — one role slot inside a card: label on the left, the assignee (or
 * a dashed "+ Assign" chip) on the right. The whole row is the tap target.
 * -------------------------------------------------------------------------- */

interface RoleRowProps {
  row: PlannerRow;
  field: AssigneeField;
  previousRow: PlannerRow | undefined;
  members: Member[];
  canWrite: boolean;
  onAssign: () => void;
}

function RoleRow({ row, field, previousRow, members, canWrite, onAssign }: RoleRowProps) {
  const assignee = row[field] as Assignee | null;
  const label = ASSIGNEE_FIELD_LABELS[field];
  const name = assigneeLabel(assignee, members);

  /* A slot only clashes when both meetings hold it and the same person fills
   * both — empty slots and different people leave it alone (mirrors the
   * desktop grid's repeat flag). */
  const key = assigneeKey(assignee);
  const isRepeat =
    key !== null && key === assigneeKey((previousRow?.[field] as Assignee | null) ?? null);
  const repeatHint = `${name} was ${label} in the previous meeting.`;

  return (
    <li>
      <button
        type="button"
        disabled={!canWrite}
        onClick={onAssign}
        aria-label={
          assignee
            ? `${label}: ${name}. Change assignee for ${plannerRowLabel(row)}${isRepeat ? `. ${repeatHint}` : ''}`
            : `Assign ${label} for ${plannerRowLabel(row)}`
        }
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-fill/60 disabled:cursor-not-allowed"
      >
        <span className="w-28 shrink-0 text-xs font-medium text-ink-soft">{label}</span>
        {assignee ? (
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            {isRepeat ? (
              <Flag size={12} weight="fill" className="shrink-0 text-rose-500" aria-hidden />
            ) : null}
            <span className={`truncate text-sm ${isRepeat ? 'text-rose-600' : 'text-ink'}`}>
              {name}
            </span>
          </span>
        ) : (
          <span className="ml-auto shrink-0 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-ink-muted">
            + Assign
          </span>
        )}
      </button>
    </li>
  );
}

/* -----------------------------------------------------------------------------
 * AssignSheet — bottom sheet wrapping one AssigneeSelect, opened by tapping a
 * role row. The draft is local to the sheet body (remounted per target via
 * `key`) and only commits on Save.
 * -------------------------------------------------------------------------- */

interface AssignSheetProps {
  state: SheetState<AssignTarget>;
  members: Member[];
  guests: Guest[];
  previousRowById: Map<string, PlannerRow>;
  onClose: () => void;
  onClosed: () => void;
  onCommit: (rowId: string, field: AssigneeField, next: Assignee | null) => void;
}

function AssignSheet({
  state,
  members,
  guests,
  previousRowById,
  onClose,
  onClosed,
  onCommit,
}: AssignSheetProps) {
  const { target, open } = state;
  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      afterOpenChange={(next) => {
        if (!next) onClosed();
      }}
      size="auto"
      /* No sheet ever nests inside this one, and the parent page is not a
       * drawer — zero-distance push only guards future nesting. */
      push={false}
      destroyOnHidden
      title={
        target ? (
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-ink">
              {ASSIGNEE_FIELD_LABELS[target.field]}
            </span>
            <span className="text-xs font-normal text-ink-muted">
              {cardTitle(target.row)}
              {target.row.dateTime ? ` · ${cardDateLine(target.row)}` : ''}
            </span>
          </span>
        ) : (
          'Assign role'
        )
      }
      styles={{
        section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        body: {
          padding: 16,
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          maxHeight: '85dvh',
          overflowY: 'auto',
        },
      }}
    >
      {target ? (
        <AssignSheetBody
          /* Remount per target so the draft always starts from the slot's
           * current value, never the previous slot's leftovers. */
          key={`${target.row.id}:${target.field}`}
          target={target}
          members={members}
          guests={guests}
          previousRow={previousRowById.get(target.row.id)}
          onCancel={onClose}
          onSave={(next) => onCommit(target.row.id, target.field, next)}
        />
      ) : null}
    </Drawer>
  );
}

interface AssignSheetBodyProps {
  target: AssignTarget;
  members: Member[];
  guests: Guest[];
  previousRow: PlannerRow | undefined;
  onCancel: () => void;
  onSave: (next: Assignee | null) => void;
}

function AssignSheetBody({
  target,
  members,
  guests,
  previousRow,
  onCancel,
  onSave,
}: AssignSheetBodyProps) {
  const { row, field } = target;
  const [draft, setDraft] = useState<Assignee | null>(row[field] as Assignee | null);

  const key = assigneeKey(row[field] as Assignee | null);
  const repeatName =
    key !== null && key === assigneeKey((previousRow?.[field] as Assignee | null) ?? null)
      ? assigneeLabel(row[field] as Assignee | null, members)
      : null;

  return (
    <div className="flex flex-col gap-4">
      {repeatName ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <Flag size={12} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
          {repeatName} was {ASSIGNEE_FIELD_LABELS[field]} in the previous meeting.
        </p>
      ) : null}
      <AssigneeSelect
        value={draft}
        onChange={setDraft}
        members={members}
        guests={guests}
        placeholder="Search or type a name…"
        ariaLabel={`${ASSIGNEE_FIELD_LABELS[field]} for ${plannerRowLabel(row)}`}
        variant="outlined"
        size="large"
      />
      <div className="grid grid-cols-2 gap-3">
        <Button size="large" block onClick={onCancel}>
          Cancel
        </Button>
        {/* Always enabled — clearing the picker and saving is how a slot
         * gets unassigned. */}
        <Button type="primary" size="large" block onClick={() => onSave(draft)}>
          Save
        </Button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * DetailsSheet — the row's non-role fields (number, date & time, theme,
 * notes), opened from the card's overflow menu. Commits everything on Save.
 * -------------------------------------------------------------------------- */

interface DetailsSheetProps {
  state: SheetState<PlannerRow>;
  onClose: () => void;
  onClosed: () => void;
  onCommit: (
    rowId: string,
    patch: Partial<Pick<PlannerRow, 'meetingNumber' | 'dateTime' | 'theme' | 'notes'>>,
  ) => void;
}

function DetailsSheet({ state, onClose, onClosed, onCommit }: DetailsSheetProps) {
  const { target, open } = state;
  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      afterOpenChange={(next) => {
        if (!next) onClosed();
      }}
      size="auto"
      push={false}
      destroyOnHidden
      title={
        target ? (
          <span className="text-sm font-semibold text-ink">Edit {cardTitle(target)}</span>
        ) : (
          'Edit details'
        )
      }
      styles={{
        section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        body: {
          padding: 16,
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          maxHeight: '85dvh',
          overflowY: 'auto',
        },
      }}
    >
      {target ? (
        <DetailsSheetBody
          key={target.id}
          row={target}
          onCancel={onClose}
          onSave={(patch) => onCommit(target.id, patch)}
        />
      ) : null}
    </Drawer>
  );
}

interface DetailsSheetBodyProps {
  row: PlannerRow;
  onCancel: () => void;
  onSave: (
    patch: Partial<Pick<PlannerRow, 'meetingNumber' | 'dateTime' | 'theme' | 'notes'>>,
  ) => void;
}

function DetailsSheetBody({ row, onCancel, onSave }: DetailsSheetBodyProps) {
  const [meetingNumber, setMeetingNumber] = useState<number | null>(row.meetingNumber);
  const [dateTime, setDateTime] = useState<Dayjs | null>(row.dateTime ? dayjs(row.dateTime) : null);
  const [theme, setTheme] = useState(row.theme);
  const [notes, setNotes] = useState(row.notes);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="planner-m-number" className="mb-1.5 block text-xs font-medium text-ink">
          Meeting number
        </label>
        <InputNumber
          id="planner-m-number"
          className="w-full"
          size="large"
          min={1}
          precision={0}
          placeholder="No."
          value={meetingNumber}
          onChange={(value) => setMeetingNumber(value ?? null)}
        />
      </div>
      <div>
        <label htmlFor="planner-m-datetime" className="mb-1.5 block text-xs font-medium text-ink">
          Date &amp; time
        </label>
        <DatePicker
          id="planner-m-datetime"
          className="w-full"
          size="large"
          showTime={{ format: 'h:mm A', minuteStep: 5, use12Hours: true }}
          format="D MMM YYYY, h:mm A"
          value={dateTime}
          /* Stored as an instant, shown local — the picker already works in
           * local time, so `toISOString` is the whole conversion (same as
           * the desktop grid). */
          onChange={(value) => setDateTime(value)}
        />
      </div>
      <div>
        <label htmlFor="planner-m-theme" className="mb-1.5 block text-xs font-medium text-ink">
          Theme
        </label>
        <Input
          id="planner-m-theme"
          size="large"
          placeholder="Meeting theme…"
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="planner-m-notes" className="mb-1.5 block text-xs font-medium text-ink">
          Notes
        </label>
        <Input.TextArea
          id="planner-m-notes"
          rows={3}
          placeholder="Anything to remember…"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button size="large" block onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="primary"
          size="large"
          block
          onClick={() =>
            onSave({
              meetingNumber,
              dateTime: dateTime ? dateTime.second(0).millisecond(0).toISOString() : null,
              theme,
              notes,
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}
