'use client';

import {
  CaretDown,
  CaretUp,
  Check,
  ShareNetwork,
  TrashSimple,
  User,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Drawer, Popconfirm } from 'antd';
import { useState } from 'react';

import { PersonAvatar } from '@/components/ui/person-avatar';
import { ProgressRing } from '@/components/ui/progress-ring';
import type { Member } from '@/lib/education/members';
import type { Meeting } from '@/lib/meetings/meetings';
import type { PreparedSpeakerWire } from '@/lib/meetings/prepared-speakers';
import { speakerAssignee } from '@/lib/meetings/prepared-speakers';
import type { Guest } from '@/lib/people/guests';
import { getGuestInitials, getGuestSwatch } from '@/lib/people/guests';

import {
  EvaluationQrSheet,
  FeedbackBadge,
  SpeakerFormFields,
  StatusPillSelect,
  speakerDisplayName,
  speakerSetupRatio,
  useEvaluationUrl,
} from './speaker-shared';

/** Mobile-only face of the Prepared Speakers tab — never mounted on desktop.
 *
 * The desktop accordion header squeezes seven controls into one row, which
 * reads as noise on a phone. Here each speaker is a small card: avatar and
 * name on the left, a setup-progress ring on the right (speaker, duration,
 * title, evaluator, path, project — see `speakerSetupRatio`), and a bottom
 * row with a "View details" button plus a share button that opens the
 * evaluation QR + link in a bottom sheet. Details open in a bottom sheet
 * that renders the exact same form the desktop accordion body does
 * (`SpeakerFormFields`), with the avatar + name in the sheet header and
 * the status picker + delete in the footer.
 *
 * Reordering gets its own explicit mode (the "Reorder" toggle beside the
 * tab's title): the action row and progress ring make way for thumb-sized
 * up/down buttons, so there's no accidental drag and no permanent arrow
 * clutter. */

/** The card's avatar: member photo or initials, guest initials with the
 * roster's hashed swatch, and a plain user glyph while the slot is empty. */
function SpeakerAvatar({
  speaker,
  members,
  guests,
  sizeClass = 'size-11',
  textClass = 'text-sm',
}: {
  speaker: PreparedSpeakerWire;
  members: Member[];
  guests: Guest[];
  sizeClass?: string;
  textClass?: string;
}) {
  const assignee = speakerAssignee(speaker, guests);

  if (!assignee) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-full bg-fill text-ink-muted ${sizeClass}`}
      >
        <User size={20} />
      </span>
    );
  }

  if (assignee.kind === 'member') {
    const member = members.find((m) => m.id === assignee.memberId);
    return (
      <PersonAvatar
        src={member?.avatarUrl}
        initials={member ? getGuestInitials(member) : '?'}
        sizeClass={sizeClass}
        textClass={textClass}
      />
    );
  }

  const [firstName = '', lastName = ''] = assignee.name.split(' ');
  return (
    <PersonAvatar
      initials={getGuestInitials({ firstName, lastName })}
      swatch={assignee.guestId ? getGuestSwatch(assignee.guestId) : undefined}
      sizeClass={sizeClass}
      textClass={textClass}
    />
  );
}

interface SpeakerCardMobileProps {
  index: number;
  speaker: PreparedSpeakerWire;
  members: Member[];
  guests: Guest[];
  /** Reorder mode: the ring and the action row make way for the move
   * buttons. */
  reordering: boolean;
  onOpen: () => void;
  onShare: () => void;
  /** `undefined` at the list's edges, where the button renders disabled. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function SpeakerCardMobile({
  index,
  speaker,
  members,
  guests,
  reordering,
  onOpen,
  onShare,
  onMoveUp,
  onMoveDown,
}: SpeakerCardMobileProps) {
  const name = speakerDisplayName(speaker, members, guests);
  const ratio = speakerSetupRatio(speaker);

  return (
    <article className="rounded-2xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-3">
        <SpeakerAvatar speaker={speaker} members={members} guests={guests} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-ink-muted">#{index}</p>
          <p className={`truncate text-sm font-semibold ${name ? 'text-ink' : 'text-ink-muted'}`}>
            {name ?? 'Unassigned speaker'}
          </p>
        </div>
        {reordering ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="large"
              aria-label={`Move speaker #${index} up`}
              disabled={!onMoveUp}
              icon={<CaretUp size={18} weight="bold" />}
              onClick={onMoveUp}
            />
            <Button
              size="large"
              aria-label={`Move speaker #${index} down`}
              disabled={!onMoveDown}
              icon={<CaretDown size={18} weight="bold" />}
              onClick={onMoveDown}
            />
          </div>
        ) : (
          <ProgressRing ratio={ratio} sizeClass="size-10">
            {ratio >= 1 ? <Check size={14} weight="bold" className="text-emerald-600" /> : null}
          </ProgressRing>
        )}
      </div>

      {reordering ? null : (
        <div className="mt-3 flex gap-2">
          <Button block size="large" onClick={onOpen}>
            View details
          </Button>
          <Button
            size="large"
            icon={<ShareNetwork size={16} />}
            onClick={onShare}
            aria-label={`Share evaluation link for speaker #${index}`}
          />
        </div>
      )}
    </article>
  );
}

interface SpeakerListMobileProps {
  meeting: Meeting;
  speakers: PreparedSpeakerWire[];
  members: Member[];
  guests: Guest[];
  /** Set by the tab when a speaker was just added — the sheet opens straight
   * to it, the mobile counterpart of the desktop auto-expand. */
  autoOpenId: string | null;
  /** Reorder mode — the toggle itself sits beside the tab's title, in the
   * header the parent renders. */
  reordering: boolean;
  onPatch: (speakerId: string, patch: Partial<PreparedSpeakerWire>) => void;
  onDelete: (speakerId: string) => void;
  onMove: (speakerId: string, direction: -1 | 1) => void;
}

export function SpeakerListMobile({
  meeting,
  speakers,
  members,
  guests,
  autoOpenId,
  reordering,
  onPatch,
  onDelete,
  onMove,
}: SpeakerListMobileProps) {
  const { message } = App.useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);

  /* Render-phase adjustment (deduped by `seenAutoOpen`) rather than an
   * effect — the same pattern the feature grid uses for its visited list,
   * and safe under StrictMode's double render. */
  const [seenAutoOpen, setSeenAutoOpen] = useState<string | null>(null);
  if (autoOpenId && autoOpenId !== seenAutoOpen) {
    setSeenAutoOpen(autoOpenId);
    setOpenId(autoOpenId);
  }

  const openIndex = speakers.findIndex((speaker) => speaker.id === openId);
  const openSpeaker = openIndex >= 0 ? speakers[openIndex] : null;
  const openName = openSpeaker ? speakerDisplayName(openSpeaker, members, guests) : undefined;

  const shareSpeaker = speakers.find((speaker) => speaker.id === shareId) ?? null;
  const shareName = shareSpeaker ? speakerDisplayName(shareSpeaker, members, guests) : undefined;
  const shareUrl = useEvaluationUrl(meeting.id, meeting.shareToken, shareSpeaker?.id ?? '');

  return (
    <>
      {reordering ? (
        <p className="mb-3 text-[11px] text-ink-muted">Set the speaking order with the arrows.</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {speakers.map((speaker, index) => (
          <SpeakerCardMobile
            key={speaker.id}
            index={index + 1}
            speaker={speaker}
            members={members}
            guests={guests}
            reordering={reordering}
            onOpen={() => setOpenId(speaker.id)}
            onShare={() => setShareId(speaker.id)}
            onMoveUp={index > 0 ? () => onMove(speaker.id, -1) : undefined}
            onMoveDown={index < speakers.length - 1 ? () => onMove(speaker.id, 1) : undefined}
          />
        ))}
      </div>

      {/* One sheet for the whole list — the form's state is all server-side
       * (blur-commit writes through), so `destroyOnHidden` is safe and keeps
       * the DOM clean between opens. `key` remounts the form per speaker.
       * `push={false}`: opening this sheet makes rc-drawer tell the parent
       * feature drawer to push — the parent's own `push={false}` is what
       * stops that; this only guards against sheets nested inside this one. */}
      <Drawer
        open={openSpeaker !== null}
        onClose={() => setOpenId(null)}
        placement="bottom"
        size="92dvh"
        push={false}
        destroyOnHidden
        title={
          openSpeaker ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <p
                className={`min-w-0 flex-1 truncate text-sm font-semibold ${openName ? 'text-ink' : 'text-ink-muted'}`}
              >
                {openName ?? 'Unassigned speaker'}
              </p>
              <SpeakerAvatar
                speaker={openSpeaker}
                members={members}
                guests={guests}
                sizeClass="size-9"
                textClass="text-xs"
              />
            </div>
          ) : null
        }
        styles={{
          section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          body: { padding: 16, overflowY: 'auto' },
          footer: {
            paddingInline: 16,
            paddingTop: 12,
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          },
        }}
        footer={
          openSpeaker ? (
            /* Status lives here rather than in the header (which the avatar
             * + name own); reorder and QR are deliberately NOT repeated —
             * the list's Reorder mode and the card's share button cover
             * those. Delete stays as the footer's only destructive action. */
            <div className="flex items-center gap-2">
              <StatusPillSelect
                value={openSpeaker.status}
                onChange={(next) => onPatch(openSpeaker.id, { status: next })}
                ariaLabel={`Status for speaker #${openIndex + 1}`}
                className="w-32 shrink-0"
              />
              <FeedbackBadge count={openSpeaker.evaluationCount} />
              <span className="flex-1" />
              <Popconfirm
                title="Delete this speaker?"
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  /* Close first so the sheet never renders a deleted speaker
                   * while the list refetch is in flight. */
                  setOpenId(null);
                  onDelete(openSpeaker.id);
                }}
              >
                <Button
                  danger
                  aria-label={`Delete speaker #${openIndex + 1}`}
                  icon={<TrashSimple size={16} />}
                />
              </Popconfirm>
            </div>
          ) : null
        }
      >
        {openSpeaker ? (
          <SpeakerFormFields
            key={openSpeaker.id}
            idPrefix={`speaker-mobile-${openSpeaker.id}`}
            speaker={openSpeaker}
            members={members}
            guests={guests}
            onPatch={(patch) => onPatch(openSpeaker.id, patch)}
          />
        ) : null}
      </Drawer>

      {/* The card share button and the details footer's QR button both land
       * here — one bottom sheet with the QR + copyable link. */}
      <EvaluationQrSheet
        open={shareSpeaker !== null}
        onClose={() => setShareId(null)}
        url={shareUrl}
        speakerName={shareName}
        speechTitle={shareSpeaker?.title.trim() ?? ''}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(shareUrl);
            message.success('Evaluation link copied');
          } catch {
            message.error('Could not copy link');
          }
        }}
      />
    </>
  );
}
