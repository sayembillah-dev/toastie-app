'use client';

import {
  CaretDown,
  ChatCircleDots,
  ImageSquare,
  Microphone,
  TextAa,
  User,
} from '@phosphor-icons/react/dist/ssr';
import { Modal } from 'antd';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import type { StoredEvaluationSubmission } from '@/lib/evaluation/storage';
import { readSubmissionsForMember, subscribeToAllSubmissions } from '@/lib/evaluation/storage';

interface PublicFeedbackFeedProps {
  memberId: string;
}

interface SlotGroup {
  meetingId: string;
  speakerId: string;
  meetingNumber?: number;
  speechTitle?: string;
  submissions: StoredEvaluationSubmission[];
}

const SUBMITTED_AT_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatSubmittedAt(iso: string): string {
  try {
    return SUBMITTED_AT_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDuration(sec: number | undefined): string {
  if (!sec || Number.isNaN(sec)) return '';
  const clamped = Math.max(0, Math.floor(sec));
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** Groups the flat submission list by (meetingId, speakerId) — a single
 * speech slot may have received feedback from several evaluators. Latest
 * slot first (by newest submission), latest submission first inside. */
function groupSubmissions(list: StoredEvaluationSubmission[]): SlotGroup[] {
  const grouped = new Map<string, SlotGroup>();
  for (const entry of list) {
    const key = `${entry.meetingId}:${entry.speakerId}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        meetingId: entry.meetingId,
        speakerId: entry.speakerId,
        meetingNumber: entry.meetingNumber,
        speechTitle: entry.speechTitle,
        submissions: [],
      };
      grouped.set(key, group);
    } else {
      /* If a later submission carries a fresher title/meetingNumber (early
       * writes may have missed the stamp) prefer that one. */
      if (!group.speechTitle && entry.speechTitle) group.speechTitle = entry.speechTitle;
      if (group.meetingNumber == null && entry.meetingNumber != null) {
        group.meetingNumber = entry.meetingNumber;
      }
    }
    group.submissions.push(entry);
  }
  const groups = Array.from(grouped.values());
  for (const group of groups) {
    group.submissions.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  }
  groups.sort((a, b) => {
    const aLatest = a.submissions[0]?.submittedAt ?? '';
    const bLatest = b.submissions[0]?.submittedAt ?? '';
    return aLatest < bLatest ? 1 : -1;
  });
  return groups;
}

interface SubmissionCardProps {
  submission: StoredEvaluationSubmission;
  onOpenImage: (dataUrl: string) => void;
}

function SubmissionCard({ submission, onOpenImage }: SubmissionCardProps) {
  const [expanded, setExpanded] = useState(true);

  const hasAudio = !!submission.audioDataUrl;
  const hasImages = submission.imageDataUrls.length > 0;
  const hasText = !!submission.text && submission.text.length > 0;

  const chips: { icon: React.ReactNode; label: string }[] = [];
  if (hasAudio) {
    const dur = formatDuration(submission.audioDurationSec);
    chips.push({
      icon: <Microphone size={11} weight="fill" />,
      label: dur ? `Audio · ${dur}` : 'Audio',
    });
  }
  if (hasImages) {
    chips.push({
      icon: <ImageSquare size={11} weight="fill" />,
      label: `${submission.imageDataUrls.length} image${submission.imageDataUrls.length === 1 ? '' : 's'}`,
    });
  }
  if (hasText) {
    chips.push({ icon: <TextAa size={11} weight="bold" />, label: 'Text' });
  }

  return (
    <article className="rounded-lg border border-line bg-canvas">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        aria-expanded={expanded}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <User size={14} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-ink">
            {submission.evaluator.name || 'Anonymous'}
            {submission.evaluator.isAssignedEvaluator ? (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
                Assigned
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-ink-muted">
            {formatSubmittedAt(submission.submittedAt)}
            {chips.length > 0 ? (
              <>
                {' · '}
                {chips.map((chip, index) => (
                  <span key={chip.label} className="inline-flex items-center">
                    {index > 0 ? <span className="mx-1 text-ink-muted/60">·</span> : null}
                    <span className="mr-1 inline-flex items-center text-ink-muted">
                      {chip.icon}
                    </span>
                    {chip.label}
                  </span>
                ))}
              </>
            ) : null}
          </p>
        </div>
        <CaretDown
          size={12}
          weight="bold"
          className={`shrink-0 text-ink-muted transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
      </button>

      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
          {hasAudio && submission.audioDataUrl ? (
            // biome-ignore lint/a11y/useMediaCaption: user-recorded spoken feedback — no caption track exists.
            <audio controls src={submission.audioDataUrl} className="w-full" preload="metadata" />
          ) : null}

          {hasImages ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {submission.imageDataUrls.map((dataUrl, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: images are content-addressed by their data URL; index is stable per submission.
                <li key={index} className="overflow-hidden rounded-md border border-line bg-fill">
                  <button
                    type="button"
                    onClick={() => onOpenImage(dataUrl)}
                    className="block w-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
                    aria-label={`Open image ${index + 1} in full size`}
                  >
                    <Thumb src={dataUrl} alt={`Image ${index + 1}`} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {hasText && submission.text ? (
            <p className="whitespace-pre-wrap rounded-md bg-fill/60 px-3 py-2 text-xs leading-relaxed text-ink">
              {submission.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Extracted so the biome/next-img suppression applies to a single, obvious
 * line — thumbnails come from data URLs that next/image can't optimise. */
function Thumb({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="aspect-square w-full object-cover" />;
}

/** Full-size image preview modal — a lightweight lightbox. */
function ImagePreview({ src, onClose }: { src: string | null; onClose: () => void }) {
  return (
    <Modal
      open={!!src}
      onCancel={onClose}
      footer={null}
      centered
      width={720}
      destroyOnHidden
      title={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ body: 'overflow-hidden rounded-2xl' }}
    >
      {src ? (
        <div className="flex items-center justify-center bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Attachment preview" className="max-h-[80vh] w-full object-contain" />
        </div>
      ) : null}
    </Modal>
  );
}

/** Public evaluations the current member has received via the shareable
 * evaluation link. Grouped per speech slot; each card lists the individual
 * submissions with inline audio / image / text viewers.
 *
 * Reads from localStorage via `useSyncExternalStore` so a submission made in
 * the same tab (e.g. a phone open next to the desk browser via the same URL
 * origin) refreshes this feed without a manual reload. */
export function PublicFeedbackFeed({ memberId }: PublicFeedbackFeedProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const subscribe = useCallback((notify: () => void) => subscribeToAllSubmissions(notify), []);
  const submissions = useSyncExternalStore(
    subscribe,
    () => readSubmissionsForMember(memberId),
    () => [] as StoredEvaluationSubmission[],
  );

  const groups = useMemo(() => groupSubmissions(submissions), [submissions]);

  if (groups.length === 0) return null;

  const total = submissions.length;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <ChatCircleDots size={14} weight="bold" />
        </span>
        <h2 className="text-sm font-semibold text-ink">Peer feedback</h2>
        <span className="ml-1 rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
          {total}
        </span>
      </header>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <article
            key={`${group.meetingId}:${group.speakerId}`}
            className="rounded-xl border border-line bg-sidebar p-4 sm:p-5"
          >
            <header className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {group.meetingNumber != null
                  ? `Meeting #${group.meetingNumber}`
                  : 'Speech feedback'}
              </p>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-ink">
                {group.speechTitle && group.speechTitle.length > 0
                  ? `“${group.speechTitle}”`
                  : 'Untitled speech'}
              </h3>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {group.submissions.length} submission
                {group.submissions.length === 1 ? '' : 's'}
              </p>
            </header>

            <div className="flex flex-col gap-2">
              {group.submissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  onOpenImage={setPreviewSrc}
                />
              ))}
            </div>
          </article>
        ))}
      </div>

      <ImagePreview src={previewSrc} onClose={() => setPreviewSrc(null)} />
    </section>
  );
}
