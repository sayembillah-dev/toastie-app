'use client';

import {
  CheckCircle,
  DotsThreeVertical,
  Link as LinkIcon,
  PaperPlaneTilt,
  PenNib,
  Trash,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Drawer, Spin } from 'antd';
import { useState } from 'react';

import { useMeetingActions } from '@/components/meetings/meeting-actions';
import { ReadOnly, useReadOnly } from '@/components/permissions/read-only';
import type { Meeting } from '@/lib/meetings/meetings';

interface MeetingActionsMobileProps {
  meeting: Meeting;
}

/** The commit bar, rebuilt for phones — the desktop row wraps into a wall of
 * buttons on a narrow screen, so mobile keeps exactly one action in view (the
 * one the meeting's state calls for) and puts the rest in a bottom sheet:
 *
 *   draft     → primary "Publish"; the sheet holds Save as Draft + Delete.
 *   published → primary "Copy link" (sharing is the next step once the club
 *               can see the agenda); the sheet holds Save as Draft — the
 *               unpublish path — and Delete.
 *
 * Every action runs through `useMeetingActions`, shared with the desktop bar,
 * so behavior can never drift between the two. */
export function MeetingActionsMobile({ meeting }: MeetingActionsMobileProps) {
  const { isPublished, pending, isDeleting, commit, copyAgendaLink, confirmDelete } =
    useMeetingActions(meeting);
  const [sheetOpen, setSheetOpen] = useState(false);
  /* The sheet rows are plain HTML — outside ConfigProvider's reach — so they
   * gate on the boolean directly, and rows a member can never use are hidden
   * rather than greyed: a phone has no hover to explain a dead button. */
  const canWrite = !useReadOnly('meeting');
  const canDelete = !useReadOnly('meeting', 'delete');

  return (
    <>
      <div className="print-hidden mb-4 flex items-center justify-between gap-2 rounded-2xl border border-line bg-canvas px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
              isPublished ? 'bg-ink text-white' : 'bg-fill text-ink-soft'
            }`}
          >
            {isPublished ? (
              <CheckCircle size={14} weight="bold" />
            ) : (
              <PenNib size={14} weight="bold" />
            )}
          </span>
          <span className="truncate text-sm font-semibold text-ink">
            {isPublished ? 'Published' : 'Draft'}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {isPublished ? (
            <Button
              size="middle"
              icon={<LinkIcon size={14} weight="bold" />}
              onClick={() => {
                void copyAgendaLink();
              }}
            >
              Copy link
            </Button>
          ) : (
            /* The one place a disabled control stays visible on mobile: it is
             * the screen's primary action, and seeing it greyed tells a
             * read-only member where they stand. */
            <ReadOnly resource="meeting">
              <Button
                type="primary"
                size="middle"
                icon={<PaperPlaneTilt size={14} weight="bold" />}
                loading={pending === 'published'}
                onClick={() => {
                  void commit('published');
                }}
              >
                Publish
              </Button>
            </ReadOnly>
          )}
          {canWrite || canDelete ? (
            <Button
              size="middle"
              aria-label="More meeting actions"
              icon={<DotsThreeVertical size={16} weight="bold" />}
              onClick={() => setSheetOpen(true)}
            />
          ) : null}
        </span>
      </div>

      {/* Bottom sheet, same shape as the guest stage picker — rounded top, no
       * close affordance, a tap on the mask dismisses. */}
      <Drawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        placement="bottom"
        size="auto"
        closable={false}
        styles={{
          body: {
            padding: 8,
            paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          },
          section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        }}
      >
        <div className="flex flex-col gap-1">
          {canWrite ? (
            <button
              type="button"
              disabled={pending !== null}
              onClick={async () => {
                /* The sheet closes on completion either way — `commit` toasts
                 * its own success or failure, so the outcome is never lost. */
                await commit('draft');
                setSheetOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 active:bg-fill disabled:opacity-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-soft">
                {pending === 'draft' ? <Spin size="small" /> : <PenNib size={18} weight="bold" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">Save as draft</span>
                <span className="block text-xs text-ink-muted">
                  {isPublished
                    ? 'Unpublish — only the committee sees it'
                    : 'Save without showing the club'}
                </span>
              </span>
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                /* Close first — the confirm modal is portalled to the body,
                 * and two stacked overlays read as a glitch. */
                setSheetOpen(false);
                confirmDelete();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 active:bg-fill disabled:opacity-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <Trash size={18} weight="bold" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-rose-600">Delete meeting</span>
                <span className="block text-xs text-ink-muted">
                  Removes the meeting and all its records
                </span>
              </span>
            </button>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
