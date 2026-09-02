'use client';

import {
  ArrowsDownUp,
  CaretDown,
  CaretUp,
  Plus,
  QrCode,
  TrashSimple,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Popconfirm, Tooltip } from 'antd';
import { useState } from 'react';

import { ReadOnly } from '@/components/permissions/read-only';
import type { Member } from '@/lib/education/members';
import type { Meeting } from '@/lib/meetings/meetings';
import type { PreparedSpeakerWire } from '@/lib/meetings/prepared-speakers';
import type { Guest } from '@/lib/people/guests';
import { useIsMobile } from '@/lib/ui/use-is-mobile';
import { useBlurCommit } from '@/lib/use-blur-commit';
import {
  useCreatePreparedSpeakerMutation,
  useDeletePreparedSpeakerMutation,
  useGetGuestsQuery,
  useGetMembersQuery,
  useGetPreparedSpeakersQuery,
  useReorderPreparedSpeakersMutation,
  useUpdatePreparedSpeakerMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

import { SpeakerListMobile } from './speaker-cards-mobile';
import {
  EvaluationQrModal,
  FeedbackBadge,
  SpeakerFormFields,
  StatusPillSelect,
  speakerDisplayName,
  useEvaluationUrl,
} from './speaker-shared';

interface SpeakerCardProps {
  index: number;
  meetingId: string;
  shareToken: string;
  speaker: PreparedSpeakerWire;
  members: Member[];
  guests: Guest[];
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<PreparedSpeakerWire>) => void;
  onDelete: () => void;
  /** Reorder callbacks — `undefined` at the list's edges, where the matching
   * button renders disabled. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/** Desktop speaker card — the collapsed accordion row plus the expandable
 * body. Mobile renders `SpeakerListMobile` instead; both share the form,
 * status pill, QR modal, and derivations from `speaker-shared`. */
function SpeakerCard({
  index,
  meetingId,
  shareToken,
  speaker,
  members,
  guests,
  expanded,
  onToggle,
  onPatch,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SpeakerCardProps) {
  const { message } = App.useApp();
  const idPrefix = `speaker-${speaker.id}`;
  const bodyId = `${idPrefix}-body`;

  const speakerName = speakerDisplayName(speaker, members, guests);

  /* The card owns the title's blur-commit (and hands it down to the form) so
   * the collapsed header echoes keystrokes live, before the blur save. */
  const titleField = useBlurCommit(speaker.title, (next) => onPatch({ title: next }));
  const trimmedTitle = titleField.value.trim();

  const [qrOpen, setQrOpen] = useState(false);
  const evaluationUrl = useEvaluationUrl(meetingId, shareToken, speaker.id);

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-sidebar">
      {/* The toggle wraps only the chevron + #/title cluster — every other
       * control stays outside so it doesn't fight the accordion for clicks.
       * The row never wraps: on narrow screens the name truncates instead, so
       * a collapsed card stays one tidy line on a phone. */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-5 sm:py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <CaretDown
            size={14}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-ink-muted transition-transform ${
              expanded ? '' : '-rotate-90'
            }`}
          />
          <span className="shrink-0 text-sm font-semibold text-ink-muted">#{index}</span>
          <span className="min-w-0 flex-1 truncate text-sm">
            {speakerName ? (
              <>
                <span className="font-semibold text-ink">{speakerName}</span>
                {trimmedTitle && (
                  <>
                    <span className="mx-1.5 text-ink-muted">·</span>
                    <span className="text-ink-muted">{trimmedTitle}</span>
                  </>
                )}
              </>
            ) : (
              <span className="font-semibold text-ink">{trimmedTitle || 'Untitled speech'}</span>
            )}
          </span>
        </button>
        {/* Move controls rather than drag-and-drop: arrows work the same on a
         * phone touchscreen as on a desktop pointer, and every move saves
         * straight through the reorder endpoint like the rest of the tab. */}
        <div className="flex shrink-0 items-center">
          <Button
            type="text"
            size="small"
            aria-label={`Move speaker #${index} up`}
            disabled={!onMoveUp}
            icon={
              <CaretUp size={16} weight="bold" className={onMoveUp ? 'text-ink-soft' : undefined} />
            }
            onClick={onMoveUp}
          />
          <Button
            type="text"
            size="small"
            aria-label={`Move speaker #${index} down`}
            disabled={!onMoveDown}
            icon={
              <CaretDown
                size={16}
                weight="bold"
                className={onMoveDown ? 'text-ink-soft' : undefined}
              />
            }
            onClick={onMoveDown}
          />
        </div>
        <StatusPillSelect
          value={speaker.status}
          onChange={(next) => onPatch({ status: next })}
          ariaLabel={`Status for speaker #${index}`}
        />
        <FeedbackBadge count={speaker.evaluationCount} />
        <Tooltip title="Show evaluation QR">
          <Button
            type="text"
            size="small"
            aria-label={`Show evaluation QR for speaker #${index}`}
            icon={<QrCode size={16} className="text-ink-muted" />}
            onClick={() => setQrOpen(true)}
          />
        </Tooltip>
        <Popconfirm
          title="Delete this speaker?"
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <Button
            danger
            type="text"
            size="small"
            aria-label={`Delete speaker #${index}`}
            icon={<TrashSimple size={16} />}
          />
        </Popconfirm>
      </div>

      <EvaluationQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={evaluationUrl}
        speakerName={speakerName}
        speechTitle={trimmedTitle}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(evaluationUrl);
            message.success('Evaluation link copied');
          } catch {
            message.error('Could not copy link');
          }
        }}
      />

      {/* Body stays mounted-then-hidden so form state doesn't reset on
       * collapse and antd Selects keep their dropdown portal roots. */}
      <div id={bodyId} hidden={!expanded} className="border-t border-line p-4 sm:p-5">
        <SpeakerFormFields
          idPrefix={idPrefix}
          speaker={speaker}
          members={members}
          guests={guests}
          onPatch={onPatch}
          titleField={titleField}
        />
      </div>
    </article>
  );
}

interface PreparedSpeakersTabProps {
  meeting: Meeting;
}

/** Prepared Speakers tab — an inline editor per speaker with a member/guest
 * picker, pathway/project cascade (which drives the level and duration
 * bounds), move up/down controls that persist the running order, and a
 * quick-add row at the bottom with no cap on how many slots a meeting can
 * hold. Every field saves straight through the API as it's changed — text
 * fields on blur, pickers and reorders immediately — matching the Roles
 * tab's no-Save-button pattern. Speakers persist server-side
 * (`MeetingSpeaker`) and mirror with the planner row this meeting was
 * created from.
 *
 * Phones get `SpeakerListMobile` instead of the accordion — cards with the
 * essential glanceable info and a bottom sheet for the editor — while the
 * data and handlers below stay exactly shared. */
export function PreparedSpeakersTab({ meeting }: PreparedSpeakersTabProps) {
  const { message } = App.useApp();
  const { data: members, isLoading: membersLoading } = useGetMembersQuery();
  const { data: guests } = useGetGuestsQuery();
  const { data: speakers, isLoading: speakersLoading } = useGetPreparedSpeakersQuery(meeting.id);
  const [createSpeaker, { isLoading: isCreating }] = useCreatePreparedSpeakerMutation();
  const [updateSpeaker] = useUpdatePreparedSpeakerMutation();
  const [deleteSpeaker] = useDeletePreparedSpeakerMutation();
  const [reorderSpeakers] = useReorderPreparedSpeakersMutation();

  /* New cards open expanded so the form is ready to fill; existing ones
   * default collapsed (absent from the set) since a term's worth of
   * speakers reads better as a scannable list. Purely local — nothing here
   * is persisted. */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  /* The mobile counterpart of the auto-expand: the id the details sheet
   * should open to. Tracked here because `handleAdd` lives here. */
  const [autoOpenId, setAutoOpenId] = useState<string | null>(null);
  /* Mobile reorder mode lives here too — its toggle sits in the header
   * beside the title, which this component renders. */
  const [reordering, setReordering] = useState(false);
  const isMobile = useIsMobile();

  const isLoading = membersLoading || speakersLoading;
  const list = speakers ?? [];

  async function handleAdd() {
    try {
      const created = await createSpeaker({ meetingId: meeting.id }).unwrap();
      setExpandedIds((prev) => new Set(prev).add(created.id));
      setAutoOpenId(created.id);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not add the speaker'));
    }
  }

  function handlePatch(speakerId: string, patch: Partial<PreparedSpeakerWire>) {
    updateSpeaker({ meetingId: meeting.id, speakerId, ...patch })
      .unwrap()
      .catch((err) => message.error(getApiErrorMessage(err, 'Could not save the change')));
  }

  async function handleDelete(speakerId: string) {
    try {
      await deleteSpeaker({ meetingId: meeting.id, speakerId }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the speaker'));
    }
  }

  /* A move is just the current order with one adjacent pair swapped — the
   * server renumbers authoritatively from the submitted id list, and the
   * mutation's optimistic cache update flows through the draft hydration to
   * the agenda and the PDF before the response even lands. */
  function handleMove(speakerId: string, direction: -1 | 1) {
    const ids = list.map((speaker) => speaker.id);
    const from = ids.indexOf(speakerId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorderSpeakers({ meetingId: meeting.id, speakerIds: ids })
      .unwrap()
      .catch((err) => message.error(getApiErrorMessage(err, 'Could not reorder the speakers')));
  }

  function toggle(speakerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(speakerId)) next.delete(speakerId);
      else next.add(speakerId);
      return next;
    });
  }

  return (
    <section className="mx-auto max-w-4xl">
      {/* Panel chrome (border/surface/padding) starts at `md` — on phones
       * this renders inside the full-width drawer, which already provides
       * both. */}
      <div className="md:rounded-2xl md:border md:border-line md:bg-canvas md:p-6">
        {/* Mobile shows no in-section title — the drawer header above already
         * names the section. The header row's right side carries the actions
         * on phones (Add beside Reorder); desktop keeps the count badge. */}
        <header
          className={`flex items-center gap-3 ${
            isMobile === true ? 'mb-3 justify-end' : 'mb-4 justify-between'
          }`}
        >
          {isMobile === true ? null : (
            <h2 className="text-base font-semibold text-ink">Prepared Speakers</h2>
          )}
          {isMobile === null ? null : isMobile ? (
            <div className="flex items-center gap-2">
              <Button
                size="small"
                icon={<Plus size={14} weight="bold" />}
                loading={isCreating}
                onClick={handleAdd}
              >
                Add speaker
              </Button>
              {list.length > 1 ? (
                <Button
                  size="small"
                  type={reordering ? 'primary' : 'default'}
                  icon={<ArrowsDownUp size={14} weight="bold" />}
                  onClick={() => setReordering((value) => !value)}
                >
                  {reordering ? 'Done' : 'Reorder'}
                </Button>
              ) : null}
            </div>
          ) : (
            list.length > 0 && (
              <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                {list.length}
              </span>
            )
          )}
        </header>

        <ReadOnly resource="meeting" display="block">
          {isLoading && list.length === 0 ? null : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
              <p className="text-sm font-medium text-ink">No speakers yet</p>
              <p className="mt-1 text-xs text-ink-muted">
                Use the button below to add the first prepared speaker.
              </p>
            </div>
          ) : /* `null` = first client frame before matchMedia settles — show
           * a neutral skeleton rather than guessing either layout. */
          isMobile === null ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <div className="h-14 animate-pulse rounded-xl bg-fill" />
              <div className="h-14 animate-pulse rounded-xl bg-fill" />
              <div className="h-14 animate-pulse rounded-xl bg-fill" />
            </div>
          ) : isMobile ? (
            <SpeakerListMobile
              meeting={meeting}
              speakers={list}
              members={members ?? []}
              guests={guests ?? []}
              autoOpenId={autoOpenId}
              reordering={reordering}
              onPatch={handlePatch}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {list.map((speaker, index) => (
                <SpeakerCard
                  key={speaker.id}
                  index={index + 1}
                  meetingId={meeting.id}
                  shareToken={meeting.shareToken}
                  speaker={speaker}
                  members={members ?? []}
                  guests={guests ?? []}
                  expanded={expandedIds.has(speaker.id)}
                  onToggle={() => toggle(speaker.id)}
                  onPatch={(patch) => handlePatch(speaker.id, patch)}
                  onDelete={() => handleDelete(speaker.id)}
                  onMoveUp={
                    list.length > 1 && index > 0 ? () => handleMove(speaker.id, -1) : undefined
                  }
                  onMoveDown={
                    list.length > 1 && index < list.length - 1
                      ? () => handleMove(speaker.id, 1)
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* The big dashed quick-add row is desktop-only — on phones Add
           * speaker lives in the header beside Reorder. */}
          {isMobile === true ? null : (
            <div className="mt-4">
              <Button
                block
                size="large"
                type="dashed"
                icon={<Plus size={16} weight="bold" />}
                loading={isCreating}
                onClick={handleAdd}
              >
                Add speaker
              </Button>
            </div>
          )}
        </ReadOnly>
      </div>
    </section>
  );
}
