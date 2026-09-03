'use client';

import { DownloadSimple } from '@phosphor-icons/react/dist/ssr';
import { Button, Popover } from 'antd';
import Image from 'next/image';
import { Fragment, useMemo } from 'react';

import { PersonAvatar } from '@/components/ui/person-avatar';
import { bannerImageCss, DEFAULT_BANNER_COLOR } from '@/lib/club/banner';
import type { ClubBannerPos } from '@/lib/club/club-profile';
import { getInitials, type OfficerRole } from '@/lib/education/members';
import type { AgendaPerson, AgendaRow } from '@/lib/meetings/agenda';
import { buildAgenda, CLUB, speakerPerson, speechSlotPerson } from '@/lib/meetings/agenda';
import type { MeetingDraft } from '@/lib/meetings/draft';
import type { Meeting } from '@/lib/meetings/meetings';
import { getGuestInitials } from '@/lib/people/guests';
import { useGetClubProfileQuery, useGetGuestsQuery, useGetMembersQuery } from '@/store/api';
import { useAppSelector } from '@/store/hooks';
import { selectMeetingDraft } from '@/store/meeting-draft-slice';

import tmLogo from '../../../assets/tm.png';
import { useMemberOf, useNameOf } from './use-name-of';

/* The printed agenda is its own visual language — Toastmasters maroon branding
 * on an A4 sheet — so it uses literal colours and pixel sizes rather than the
 * app's design tokens. Everything here has to survive being printed on paper. */
const RULE = '#1a3f6f';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** `3-Jul-2026`, the format the club's printed agenda uses. */
function formatSheetDate(date: Date): string {
  return `${date.getDate()}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

/** `September 3, 2026` — the long date that opens the officer rail. */
function formatRailDate(date: Date): string {
  return `${FULL_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** `11:30 AM` — 12-hour, no leading zero on the hour. */
function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

function SheetHeader({ meeting, theme }: { meeting: Meeting; theme: string }) {
  // Banner identity comes from the club profile (name + banner colour/image);
  // the hard-coded CLUB name only covers the loading splash. The sub-line
  // under the club name carries the meeting theme.
  const { data: club } = useGetClubProfileQuery();
  const themeLine = theme.trim();

  /* Banner background precedence: a custom image (positioned exactly as the
   * admin dragged it in club settings) wins over the picked colour, which
   * wins over the official Toastmasters maroon. The image keeps the picked
   * colour (or maroon) behind it so the strip is never blank while the file
   * loads. */
  const bannerBackground: React.CSSProperties = {
    backgroundColor: club?.bannerColor?.trim() || DEFAULT_BANNER_COLOR,
  };
  if (club?.bannerImageUrl) {
    const pos: ClubBannerPos = club.bannerImagePos ?? { x: 50, y: 50, zoom: 1 };
    Object.assign(bannerBackground, bannerImageCss(club.bannerImageUrl, pos));
  }

  return (
    <>
      {/* The banner bleeds edge to edge — no border, no inset, no background
       * artwork; in print the sheet's zero page margin lets it run to the
       * paper. */}
      <div
        style={{
          ...bannerBackground,
          position: 'relative',
          overflow: 'hidden',
          height: 96,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            flexShrink: 0,
            width: 108,
            height: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 20,
          }}
        >
          <Image
            src={tmLogo}
            alt="Toastmasters logo"
            width={76}
            height={76}
            priority
            unoptimized
            style={{ width: 76, height: 76, objectFit: 'contain' }}
          />
        </div>
        <div
          style={{
            flex: '1 1 0%',
            textAlign: 'right',
            paddingRight: 20,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 }}>
            {club?.name ?? CLUB.name}
          </div>
          {themeLine ? (
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255, 255, 255, 0.8)',
                letterSpacing: 1,
                marginTop: 2,
              }}
            >
              {themeLine}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="agenda-sheet-inset"
        style={{
          padding: '5px 16px',
          borderBottom: `2px solid ${RULE}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 28,
          fontSize: 11,
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>{formatSheetDate(new Date(meeting.dateTime))}</span>
        <span>
          Meeting # <strong>{meeting.meetingNumber}</strong>
        </span>
        <span>
          Theme of the day: &nbsp;<strong>{theme}</strong>
        </span>
      </div>
    </>
  );
}

/** One labelled block in the left rail — a navy underlined heading over its
 * value(s). */
function RailSection({
  title,
  accent = RULE,
  children,
  gap = 11,
}: {
  title: string;
  /** Heading + rule colour — maroon for the club officers, navy elsewhere. */
  accent?: string;
  children: React.ReactNode;
  gap?: number;
}) {
  return (
    <div style={{ marginBottom: gap }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 'bold',
          color: accent,
          borderBottom: `1px solid ${accent}`,
          paddingBottom: 2,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function RailName({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9.5, fontStyle: 'italic', color: '#1f2937', lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

/** What the popover shows — the person's face, name, and bio. Resolved once
 * at the sheet level from the roster/guest lists the meeting views already
 * hold, so a name that matches nothing (a stale id) simply renders as plain
 * text with no popover. */
interface PersonTipInfo {
  bio?: string;
  avatarUrl?: string | null;
  initials: string;
}

type TipResolver = (person: AgendaPerson) => PersonTipInfo | undefined;

/** One clickable name on the sheet. The popover is screen-only chrome:
 * portaled outside the page and hidden by `@media print`, while the trigger
 * itself inherits the cell's typography and loses its underline when
 * printing — so the PDF looks exactly as it did before names were
 * clickable. */
function PersonTip({ person, tipOf }: { person: AgendaPerson; tipOf: TipResolver }) {
  const tip = tipOf(person);
  if (!tip) return <>{person.name}</>;

  return (
    <Popover
      trigger="click"
      placement="topLeft"
      content={
        <div className="w-60 max-w-[76vw]">
          <div className="flex items-center gap-2.5">
            <PersonAvatar src={tip.avatarUrl} initials={tip.initials} sizeClass="size-9" />
            <div className="min-w-0 text-sm font-semibold leading-tight text-ink">
              {person.name}
            </div>
          </div>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
            {tip.bio?.trim() || 'No bio added yet.'}
          </p>
        </div>
      }
    >
      <button
        type="button"
        aria-label={`About ${person.name}`}
        className="person-tip"
        style={{
          font: 'inherit',
          color: 'inherit',
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          textDecoration: 'underline dotted',
          textUnderlineOffset: 2,
        }}
      >
        {person.name}
      </button>
    </Popover>
  );
}

/** A person cell: one popover trigger per identity, comma-joined exactly like
 * the `person` string it replaces; falls back to the plain string when the
 * cell carries no identities (typed guest names, unfilled slots). */
function PersonList({
  people,
  fallback,
  tipOf,
}: {
  people: AgendaPerson[] | undefined;
  fallback: string | undefined;
  tipOf: TipResolver;
}) {
  if (!people || people.length === 0) return <>{fallback}</>;
  /* Keys are unique per cell without an index: the only multi-person cell is
   * the evaluations line, which buildAgenda already dedupes. */
  return (
    <>
      {people.map((person, index) => (
        <Fragment key={person.memberId ?? person.guestId ?? person.name}>
          {index > 0 ? ', ' : null}
          <PersonTip person={person} tipOf={tipOf} />
        </Fragment>
      ))}
    </>
  );
}

/** Club officers as they print on the agenda rail — Toastmasters protocol
 * order, with the long title each office carries on paper. */
const OFFICER_PRINT_ORDER: Array<{ role: OfficerRole; label: string }> = [
  { role: 'President', label: 'President' },
  { role: 'VPE', label: 'VP Education' },
  { role: 'VPM', label: 'VP Membership' },
  { role: 'VPPR', label: 'VP Public Relations' },
  { role: 'Secretary', label: 'Secretary' },
  { role: 'Treasurer', label: 'Treasurer' },
  { role: 'SAA', label: 'Sergeant at Arms' },
];

interface SheetRailProps {
  meeting: Meeting;
  draft: MeetingDraft;
  nameOf: (memberId: string | undefined) => string;
  tipOf: TipResolver;
}

/** Left rail: the meeting date and the club's officers in protocol order,
 * then the evaluators, prepared speakers, club mission, and word of the day.
 * Meeting roles no longer print here — the run-of-show table already names
 * each role-holder at their line. */
function SheetRail({ meeting, draft, nameOf, tipOf }: SheetRailProps) {
  const { data: members } = useGetMembersQuery();
  const { word } = draft;

  /* An office prints even while vacant ('—'), and every holder when several
   * members share one (small clubs double up). Only active roster rows count. */
  const officers = OFFICER_PRINT_ORDER.map(({ role, label }) => ({
    label,
    holders: (members ?? []).filter(
      (member) => member.status === 'active' && member.roles.includes(role),
    ),
  }));

  /* Every speech evaluator named once — the same dedupe the run-of-show's
   * evaluations line uses, one row per person here. A typed-name guest with
   * no roster row still prints (as plain text — there is no bio to pop). */
  const evaluators: AgendaPerson[] = [];
  for (const speaker of draft.speakers) {
    const entry = speechSlotPerson(
      nameOf,
      speaker.evaluatorId,
      speaker.evaluatorGuestId,
      speaker.evaluatorName,
    ) ?? { name: speakerPerson(nameOf, speaker.evaluatorId, speaker.evaluatorName) };
    if (entry.name && !evaluators.some((seen) => seen.name === entry.name)) {
      evaluators.push(entry);
    }
  }

  return (
    <div
      style={{
        width: 148,
        flexShrink: 0,
        borderRight: '1px solid #d1d5db',
        padding: 10,
      }}
    >
      {/* The meeting date opens the rail, over the officer list. */}
      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#111827', marginBottom: 11 }}>
        {formatRailDate(new Date(meeting.dateTime))}
      </div>

      {officers.map(({ label, holders }) => (
        <RailSection key={label} title={label} accent={DEFAULT_BANNER_COLOR}>
          {holders.length === 0 ? (
            <div style={{ fontSize: 9.5, color: '#1f2937', lineHeight: 1.4 }}>—</div>
          ) : (
            holders.map((member) => {
              const name = `${member.firstName} ${member.lastName}`.trim();
              return (
                <div key={member.id} style={{ fontSize: 9.5, color: '#1f2937', lineHeight: 1.4 }}>
                  <PersonTip person={{ memberId: member.id, name }} tipOf={tipOf} />
                </div>
              );
            })
          )}
        </RailSection>
      ))}

      <RailSection title="Prepared Speech Evaluators">
        {evaluators.length === 0 ? (
          <RailName>—</RailName>
        ) : (
          evaluators.map((person) => (
            <RailName key={person.memberId ?? person.guestId ?? person.name}>
              <PersonTip person={person} tipOf={tipOf} />
            </RailName>
          ))
        )}
      </RailSection>

      <RailSection title="Prepared Speakers">
        {draft.speakers.length === 0 ? (
          <RailName>—</RailName>
        ) : (
          draft.speakers.map((speaker, index) => {
            const person = speechSlotPerson(
              nameOf,
              speaker.memberId,
              speaker.guestId,
              speaker.speakerName,
            );
            return (
              <div key={speaker.id} style={{ fontSize: 9.5, marginBottom: 3, fontStyle: 'italic' }}>
                {index + 1}.&nbsp;
                {person ? (
                  <PersonTip person={person} tipOf={tipOf} />
                ) : (
                  speakerPerson(nameOf, speaker.memberId, speaker.speakerName) || 'To be confirmed'
                )}
              </div>
            );
          })
        )}
      </RailSection>

      <RailSection title="Mission of the Club" gap={12}>
        <div style={{ fontSize: 8.5, lineHeight: 1.65, color: '#374151' }}>{CLUB.mission}</div>
      </RailSection>

      <RailSection title="Word of the Day" gap={0}>
        <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>{word.word || '—'}</div>
        {word.partOfSpeech ? (
          <div style={{ fontSize: 9, fontStyle: 'italic', color: '#4b5563', marginBottom: 3 }}>
            ({word.partOfSpeech})
          </div>
        ) : null}
        {word.meaning ? (
          <div style={{ fontSize: 9, lineHeight: 1.5, marginBottom: 4 }}>
            <strong>Meaning:&nbsp;</strong>
            {word.meaning}
          </div>
        ) : null}
        {word.example ? (
          <div style={{ fontSize: 9, lineHeight: 1.5, fontStyle: 'italic', color: '#374151' }}>
            “{word.example}”
          </div>
        ) : null}
      </RailSection>
    </div>
  );
}

const HEAD_CELL: React.CSSProperties = {
  fontSize: 11,
  textAlign: 'left',
  paddingBottom: 5,
  color: RULE,
};

const BLOCK_CELL: React.CSSProperties = {
  padding: '7px 8px 7px 0',
  fontSize: 13,
  fontWeight: 'bold',
  verticalAlign: 'top',
};

const LINE_CELL: React.CSSProperties = {
  padding: '3px 8px 3px 0',
  fontSize: 12,
  verticalAlign: 'top',
};

function SheetTable({ rows, tipOf }: { rows: AgendaRow[]; tipOf: TipResolver }) {
  return (
    <div style={{ flex: '1 1 0%', padding: '10px 12px 12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${RULE}` }}>
            <th style={{ ...HEAD_CELL, width: 68 }}>Time</th>
            <th style={HEAD_CELL}>Description</th>
            <th style={{ ...HEAD_CELL, width: '30%' }}>Person</th>
            <th style={{ ...HEAD_CELL, width: 32, textAlign: 'center' }}>Min</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            /* A block and its lines share a body group so a page break never
             * strands a heading at the foot of a page. */
            <Fragment key={row.title}>
              <tr style={{ borderTop: `1px solid ${RULE}` }}>
                <td style={{ ...BLOCK_CELL, color: RULE, whiteSpace: 'nowrap', width: 68 }}>
                  {formatClock(row.startsAt)}
                </td>
                <td style={BLOCK_CELL}>{row.title}</td>
                <td style={{ ...BLOCK_CELL, fontWeight: 600, width: '30%' }}>
                  <PersonList people={row.people} fallback={row.person} tipOf={tipOf} />
                </td>
                <td style={{ ...BLOCK_CELL, fontWeight: 'normal', textAlign: 'center', width: 32 }}>
                  {row.displayMinutes}
                </td>
              </tr>
              {row.lines.map((line) => (
                <tr key={line.key}>
                  <td style={{ padding: '1px 0' }} />
                  <td
                    style={{
                      ...LINE_CELL,
                      paddingLeft: 18,
                      fontSize: line.meta ? 11 : 12,
                      fontStyle: line.meta ? 'italic' : 'normal',
                      color: line.meta ? '#6b7280' : '#1f2937',
                    }}
                  >
                    {line.label}
                  </td>
                  <td style={{ ...LINE_CELL, fontWeight: 600 }}>
                    <PersonList people={line.people} fallback={line.person} tipOf={tipOf} />
                  </td>
                  <td style={{ ...LINE_CELL, textAlign: 'center' }}>{line.minutes}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface AgendaPreviewProps {
  meeting: Meeting;
}

/**
 * Print-ready agenda for the meeting, assembled from what the other tabs hold in
 * the meeting draft. The sheet is a true A4 page (210mm) so what is previewed on
 * screen is exactly what the browser lays out when it prints.
 */
export function AgendaPreview({ meeting }: AgendaPreviewProps) {
  const draft = useAppSelector((state) => selectMeetingDraft(state, meeting.id));
  const nameOf = useNameOf();
  const memberOf = useMemberOf();
  const { data: guests } = useGetGuestsQuery();

  const rows = useMemo(() => buildAgenda(meeting, draft, nameOf), [meeting, draft, nameOf]);

  /* Resolves a printed name's identity to what the popover shows — face,
   * name, bio. Members read from the roster (`Member.bio` comes from the
   * shared identity server-side), guests from the club's guest list. A name
   * with no resolvable identity renders as plain text instead. */
  const tipOf = useMemo<TipResolver>(() => {
    const guestById = new Map((guests ?? []).map((guest) => [guest.id, guest]));
    return (person) => {
      if (person.memberId) {
        const member = memberOf(person.memberId);
        if (!member) return undefined;
        return { bio: member.bio, avatarUrl: member.avatarUrl, initials: getInitials(member) };
      }
      if (person.guestId) {
        const guest = guestById.get(person.guestId);
        if (!guest) return undefined;
        return { bio: guest.bio, avatarUrl: guest.avatarUrl, initials: getGuestInitials(guest) };
      }
      return undefined;
    };
  }, [memberOf, guests]);

  /* The browser's own print pipeline is the PDF writer — it already knows how to
   * paginate the sheet, and it keeps the page vector-sharp and selectable. */
  function handleDownload() {
    window.print();
  }

  return (
    <div className="agenda-print-root overflow-hidden rounded-xl border border-line bg-[#e8e8e8]">
      <div className="print-hidden flex flex-wrap items-center gap-3 border-b border-line bg-canvas px-4 py-3">
        <Button
          type="primary"
          icon={<DownloadSimple size={16} weight="bold" />}
          onClick={handleDownload}
        >
          Download PDF
        </Button>
        <span className="text-xs text-ink-muted">
          Opens your browser&apos;s print dialog — choose <strong>Save as PDF</strong> for an{' '}
          <strong>A4</strong> file.
        </span>
      </div>

      {/* The sheet is a fixed 210mm, so narrow screens scroll it sideways rather
       * than squashing the layout the printer will use. */}
      <div className="agenda-print-wrap overflow-x-auto px-0 py-6">
        <div
          className="agenda-page"
          style={{
            width: '210mm',
            margin: '0 auto',
            background: 'white',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.18)',
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#111827',
          }}
        >
          <SheetHeader meeting={meeting} theme={draft.theme.trim() || meeting.theme} />
          <div className="agenda-sheet-inset" style={{ display: 'flex' }}>
            <SheetRail meeting={meeting} draft={draft} nameOf={nameOf} tipOf={tipOf} />
            <SheetTable rows={rows} tipOf={tipOf} />
          </div>
        </div>
      </div>
    </div>
  );
}
