'use client';

import { DownloadSimple } from '@phosphor-icons/react/dist/ssr';
import { Button } from 'antd';
import Image from 'next/image';
import { Fragment, useMemo } from 'react';

import type { AgendaRow } from '@/lib/meetings/agenda';
import { buildAgenda, CLUB, holderName, speakerPerson } from '@/lib/meetings/agenda';
import type { MeetingDraft } from '@/lib/meetings/draft';
import type { Meeting } from '@/lib/meetings/meetings';
import { buildRoles } from '@/lib/meetings/roles';
import { useAppSelector } from '@/store/hooks';
import { selectMeetingDraft } from '@/store/meeting-draft-slice';

import tmLogo from '../../../assets/tm.png';
import { useNameOf } from './use-name-of';

/* The printed agenda is its own visual language — navy Toastmasters branding on
 * an A4 sheet — so it uses literal colours and pixel sizes rather than the app's
 * design tokens. Everything here has to survive being printed on paper. */
const NAVY = '#003366';
const RULE = '#1a3f6f';
const BAND = '#d6e4f0';

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

/** `3-Jul-2026`, the format the club's printed agenda uses. */
function formatSheetDate(date: Date): string {
  return `${date.getDate()}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

/** `11:30 AM` — 12-hour, no leading zero on the hour. */
function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

/** The rays fanning out behind the header, as on the club's letterhead: 19 lines
 * over a half-turn, every third one heavier. */
function HeaderRays() {
  const rays = Array.from({ length: 19 }, (_, index) => {
    const angle = ((-90 + index * 10) * Math.PI) / 180;
    return {
      key: index,
      x2: 400 + Math.cos(angle) * 900,
      y2: 36 + Math.sin(angle) * 900,
      width: index % 3 === 0 ? 3 : 1.5,
    };
  });

  return (
    <svg
      viewBox="0 0 800 72"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}
    >
      <title>Decorative header rays</title>
      {rays.map((ray) => (
        <line
          key={ray.key}
          x1={400}
          y1={36}
          x2={ray.x2}
          y2={ray.y2}
          stroke="white"
          strokeWidth={ray.width}
        />
      ))}
    </svg>
  );
}

function SheetHeader({ meeting, theme }: { meeting: Meeting; theme: string }) {
  return (
    <>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: NAVY,
          height: 72,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <HeaderRays />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            flexShrink: 0,
            width: 68,
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 12,
          }}
        >
          <Image
            src={tmLogo}
            alt="Toastmasters logo"
            width={52}
            height={52}
            priority
            unoptimized
            style={{ width: 52, height: 52, objectFit: 'contain' }}
          />
        </div>
        <div
          style={{
            flex: '1 1 0%',
            textAlign: 'right',
            paddingRight: 16,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 }}>
            {CLUB.name}
          </div>
          <div style={{ fontSize: 10, color: '#b8d4f0', letterSpacing: 1, marginTop: 2 }}>
            District {CLUB.district} &nbsp;·&nbsp; Division {CLUB.division} &nbsp;·&nbsp; Area{' '}
            {CLUB.area}
          </div>
        </div>
      </div>

      <div style={{ background: BAND, height: 8 }} />

      <div
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
  children,
  gap = 11,
}: {
  title: string;
  children: React.ReactNode;
  gap?: number;
}) {
  return (
    <div style={{ marginBottom: gap }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 'bold',
          color: RULE,
          borderBottom: `1px solid ${RULE}`,
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

interface SheetRailProps {
  meeting: Meeting;
  draft: MeetingDraft;
  nameOf: (memberId: string | undefined) => string;
}

/** Left rail: the officers and role-holders, the club mission, and the word of
 * the day — everything the Roles, Prepared Speakers and Theme tabs collected. */
function SheetRail({ meeting, draft, nameOf }: SheetRailProps) {
  const roles = buildRoles(meeting);
  const { word } = draft;

  const evaluators = [
    ...new Set(
      draft.speakers
        .map((speaker) => speakerPerson(nameOf, speaker.evaluatorId, speaker.evaluatorName))
        .filter(Boolean),
    ),
  ];

  return (
    <div
      style={{
        width: 148,
        flexShrink: 0,
        borderRight: '1px solid #d1d5db',
        padding: 10,
      }}
    >
      {roles.map((role) => (
        <RailSection key={role.key} title={role.label}>
          <RailName>{holderName(nameOf, draft.roles[role.key]) || '—'}</RailName>
        </RailSection>
      ))}

      <RailSection title="Prepared Speech Evaluators">
        {evaluators.length === 0 ? (
          <RailName>—</RailName>
        ) : (
          evaluators.map((name) => <RailName key={name}>{name}</RailName>)
        )}
      </RailSection>

      <RailSection title="Prepared Speakers">
        {draft.speakers.length === 0 ? (
          <RailName>—</RailName>
        ) : (
          draft.speakers.map((speaker, index) => (
            <div key={speaker.id} style={{ fontSize: 9.5, marginBottom: 3, fontStyle: 'italic' }}>
              {index + 1}.&nbsp;
              {speakerPerson(nameOf, speaker.memberId, speaker.speakerName) || 'To be confirmed'}
            </div>
          ))
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

function SheetTable({ rows }: { rows: AgendaRow[] }) {
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
                <td style={{ ...BLOCK_CELL, fontWeight: 600, width: '30%' }}>{row.person}</td>
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
                  <td style={{ ...LINE_CELL, fontWeight: 600 }}>{line.person}</td>
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

  const rows = useMemo(() => buildAgenda(meeting, draft, nameOf), [meeting, draft, nameOf]);

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
          <div style={{ display: 'flex' }}>
            <SheetRail meeting={meeting} draft={draft} nameOf={nameOf} />
            <SheetTable rows={rows} />
          </div>
        </div>
      </div>
    </div>
  );
}
