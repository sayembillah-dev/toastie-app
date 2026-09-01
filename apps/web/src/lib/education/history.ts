import type { Level, Member, Pathway } from './members';

/** Standard Toastmasters meeting roles a member can take on. Kept as a literal
 * tuple so the type of `MeetingRole` is the exact set of allowed values. */
export const MEETING_ROLES = [
  'Toastmaster of the Day',
  'General Evaluator',
  'Table Topics Master',
  'Evaluator',
  'Grammarian',
  'Ah Counter',
  'Timer',
  'Sergeant at Arms',
  'Hakmaster',
] as const;

export type MeetingRole = (typeof MEETING_ROLES)[number];

/**
 * The member journey is a stream of discrete events. Anything the profile
 * timeline needs to render has to be expressible as one of these variants.
 */
export type HistoryEvent =
  | { id: string; memberId: string; date: string; type: 'joined' }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'level-reached';
      level: Level;
      pathway: Pathway;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'speech-given';
      title: string;
      meetingNumber: number;
      projectName?: string;
      /** Present when this speech has a real `MeetingSpeaker` slot behind
       * it — joins against `EvaluationSubmission.meetingSpeakerId` to show
       * received feedback under this speech. */
      meetingSpeakerId?: string;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'project-started';
      projectName: string;
      level: Level;
      pathway: Pathway;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'project-completed';
      projectName: string;
      level: Level;
      pathway: Pathway;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'role-taken';
      role: MeetingRole;
      meetingNumber: number;
    };

export type HistoryEventKind = HistoryEvent['type'];

/** Extra fields the timeline needs but that aren't derivable from history alone. */
export interface MemberProfileExtras {
  /** ISO date used as the anchor if there is no `joined` event in history. */
  joinedAt: string;
  /** Baseline meeting attendance — history captures speeches only, not every
   * meeting a member sat in on, so this comes from club records instead. */
  meetingsAttended: number;
}

export const DEFAULT_EXTRAS: MemberProfileExtras = {
  joinedAt: '2025-01-15',
  meetingsAttended: 12,
};

/* Deep, story-shaped histories for the first two members and thinner seeds for
 * the rest — enough variety to exercise every event card without turning the
 * seed file into a novel. */
export const HISTORY_SEED: Record<string, HistoryEvent[]> = {
  'm-01': [
    { id: 'm-01-e1', memberId: 'm-01', type: 'joined', date: '2024-02-10' },
    {
      id: 'm-01-e2',
      memberId: 'm-01',
      type: 'project-started',
      date: '2024-02-24',
      projectName: 'Ice Breaker',
      level: 1,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e3',
      memberId: 'm-01',
      type: 'speech-given',
      date: '2024-03-09',
      title: 'The Long Way Home',
      meetingNumber: 4,
      projectName: 'Ice Breaker',
    },
    {
      id: 'm-01-e4',
      memberId: 'm-01',
      type: 'project-completed',
      date: '2024-03-09',
      projectName: 'Ice Breaker',
      level: 1,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e5',
      memberId: 'm-01',
      type: 'level-reached',
      date: '2024-03-09',
      level: 1,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e6',
      memberId: 'm-01',
      type: 'project-started',
      date: '2024-04-06',
      projectName: 'Evaluation and Feedback',
      level: 2,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e7',
      memberId: 'm-01',
      type: 'speech-given',
      date: '2024-05-11',
      title: 'Listening with Intent',
      meetingNumber: 8,
      projectName: 'Evaluation and Feedback',
    },
    {
      id: 'm-01-e8',
      memberId: 'm-01',
      type: 'project-completed',
      date: '2024-06-15',
      projectName: 'Evaluation and Feedback',
      level: 2,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e9',
      memberId: 'm-01',
      type: 'level-reached',
      date: '2024-06-15',
      level: 2,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e10',
      memberId: 'm-01',
      type: 'project-started',
      date: '2024-08-03',
      projectName: 'Understanding Your Communication Style',
      level: 3,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e11',
      memberId: 'm-01',
      type: 'speech-given',
      date: '2024-09-14',
      title: 'Reading the Room',
      meetingNumber: 15,
      projectName: 'Understanding Your Communication Style',
    },
    {
      id: 'm-01-e12',
      memberId: 'm-01',
      type: 'project-completed',
      date: '2024-11-16',
      projectName: 'Understanding Your Communication Style',
      level: 3,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e13',
      memberId: 'm-01',
      type: 'level-reached',
      date: '2024-11-16',
      level: 3,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e14',
      memberId: 'm-01',
      type: 'project-started',
      date: '2025-01-11',
      projectName: 'Managing a Difficult Audience',
      level: 4,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e15',
      memberId: 'm-01',
      type: 'speech-given',
      date: '2025-04-05',
      title: 'When the Room Turns',
      meetingNumber: 21,
      projectName: 'Managing a Difficult Audience',
    },
    {
      id: 'm-01-e16',
      memberId: 'm-01',
      type: 'project-completed',
      date: '2026-02-14',
      projectName: 'Managing a Difficult Audience',
      level: 4,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e17',
      memberId: 'm-01',
      type: 'level-reached',
      date: '2026-02-14',
      level: 4,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e18',
      memberId: 'm-01',
      type: 'project-started',
      date: '2026-03-07',
      projectName: 'Prepare for Success',
      level: 5,
      pathway: 'Presentation Mastery',
    },
    {
      id: 'm-01-e19',
      memberId: 'm-01',
      type: 'speech-given',
      date: '2026-06-13',
      title: 'The Anatomy of a Standing Ovation',
      meetingNumber: 34,
      projectName: 'Prepare for Success',
    },
    {
      id: 'm-01-r1',
      memberId: 'm-01',
      type: 'role-taken',
      date: '2024-04-20',
      role: 'Timer',
      meetingNumber: 6,
    },
    {
      id: 'm-01-r2',
      memberId: 'm-01',
      type: 'role-taken',
      date: '2024-08-17',
      role: 'Grammarian',
      meetingNumber: 14,
    },
    {
      id: 'm-01-r3',
      memberId: 'm-01',
      type: 'role-taken',
      date: '2025-02-08',
      role: 'Table Topics Master',
      meetingNumber: 19,
    },
    {
      id: 'm-01-r4',
      memberId: 'm-01',
      type: 'role-taken',
      date: '2025-11-15',
      role: 'Toastmaster of the Day',
      meetingNumber: 29,
    },
    {
      id: 'm-01-r5',
      memberId: 'm-01',
      type: 'role-taken',
      date: '2026-07-11',
      role: 'General Evaluator',
      meetingNumber: 35,
    },
  ],
  'm-02': [
    { id: 'm-02-e1', memberId: 'm-02', type: 'joined', date: '2023-06-04' },
    {
      id: 'm-02-e2',
      memberId: 'm-02',
      type: 'project-started',
      date: '2023-06-18',
      projectName: 'Ice Breaker',
      level: 1,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e3',
      memberId: 'm-02',
      type: 'speech-given',
      date: '2023-07-01',
      title: 'From Whiteboard to Whiteboard',
      meetingNumber: 3,
      projectName: 'Ice Breaker',
    },
    {
      id: 'm-02-e4',
      memberId: 'm-02',
      type: 'project-completed',
      date: '2023-07-01',
      projectName: 'Ice Breaker',
      level: 1,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e5',
      memberId: 'm-02',
      type: 'level-reached',
      date: '2023-07-01',
      level: 1,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e6',
      memberId: 'm-02',
      type: 'level-reached',
      date: '2023-11-04',
      level: 2,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e7',
      memberId: 'm-02',
      type: 'level-reached',
      date: '2024-04-20',
      level: 3,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e8',
      memberId: 'm-02',
      type: 'level-reached',
      date: '2025-01-18',
      level: 4,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e9',
      memberId: 'm-02',
      type: 'project-started',
      date: '2025-08-09',
      projectName: 'Ethical Leadership',
      level: 5,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e10',
      memberId: 'm-02',
      type: 'speech-given',
      date: '2026-01-24',
      title: 'The Coach You Never Had',
      meetingNumber: 41,
      projectName: 'Ethical Leadership',
    },
    {
      id: 'm-02-e11',
      memberId: 'm-02',
      type: 'project-completed',
      date: '2026-05-30',
      projectName: 'Ethical Leadership',
      level: 5,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e12',
      memberId: 'm-02',
      type: 'level-reached',
      date: '2026-05-30',
      level: 5,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e13',
      memberId: 'm-02',
      type: 'project-started',
      date: '2026-06-20',
      projectName: 'Reflect on Your Path',
      level: 5,
      pathway: 'Effective Coaching',
    },
    {
      id: 'm-02-e14',
      memberId: 'm-02',
      type: 'speech-given',
      date: '2026-07-18',
      title: 'Everything I Learned From Being Wrong',
      meetingNumber: 47,
      projectName: 'Reflect on Your Path',
    },
    {
      id: 'm-02-r1',
      memberId: 'm-02',
      type: 'role-taken',
      date: '2023-09-16',
      role: 'Ah Counter',
      meetingNumber: 8,
    },
    {
      id: 'm-02-r2',
      memberId: 'm-02',
      type: 'role-taken',
      date: '2024-02-03',
      role: 'Evaluator',
      meetingNumber: 15,
    },
    {
      id: 'm-02-r3',
      memberId: 'm-02',
      type: 'role-taken',
      date: '2024-10-05',
      role: 'Toastmaster of the Day',
      meetingNumber: 25,
    },
    {
      id: 'm-02-r4',
      memberId: 'm-02',
      type: 'role-taken',
      date: '2025-05-17',
      role: 'General Evaluator',
      meetingNumber: 33,
    },
    {
      id: 'm-02-r5',
      memberId: 'm-02',
      type: 'role-taken',
      date: '2026-03-14',
      role: 'Sergeant at Arms',
      meetingNumber: 43,
    },
    {
      id: 'm-02-r6',
      memberId: 'm-02',
      type: 'role-taken',
      date: '2026-08-01',
      role: 'Toastmaster of the Day',
      meetingNumber: 48,
    },
  ],
  'm-08': [
    { id: 'm-08-e1', memberId: 'm-08', type: 'joined', date: '2026-05-02' },
    {
      id: 'm-08-e2',
      memberId: 'm-08',
      type: 'project-started',
      date: '2026-05-16',
      projectName: 'Ice Breaker',
      level: 1,
      pathway: 'Engaging Humor',
    },
    {
      id: 'm-08-e3',
      memberId: 'm-08',
      type: 'speech-given',
      date: '2026-06-06',
      title: 'The Time I Broke a Piñata Wrong',
      meetingNumber: 2,
      projectName: 'Ice Breaker',
    },
    {
      id: 'm-08-r1',
      memberId: 'm-08',
      type: 'role-taken',
      date: '2026-06-20',
      role: 'Timer',
      meetingNumber: 3,
    },
    {
      id: 'm-08-r2',
      memberId: 'm-08',
      type: 'role-taken',
      date: '2026-07-25',
      role: 'Ah Counter',
      meetingNumber: 4,
    },
  ],
};

export const EXTRAS_SEED: Record<string, MemberProfileExtras> = {
  'm-01': { joinedAt: '2024-02-10', meetingsAttended: 38 },
  'm-02': { joinedAt: '2023-06-04', meetingsAttended: 52 },
  'm-08': { joinedAt: '2026-05-02', meetingsAttended: 4 },
};

/** Latest-first, tie-broken by id so ordering is deterministic for React keys. */
export function sortEvents(events: HistoryEvent[]): HistoryEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/** Fallback used when a member has no seeded history. Reads what the member
 * has volunteered so far — a fresh join returns just the join event; a member
 * who has run the Start Pathway flow gets a matching `project-started`. */
export function synthesiseHistory(member: Member): HistoryEvent[] {
  const extras = EXTRAS_SEED[member.id] ?? DEFAULT_EXTRAS;
  const joinedAt = member.pathwayStartedAt ?? extras.joinedAt;
  const joined: HistoryEvent = {
    id: `${member.id}-joined`,
    memberId: member.id,
    type: 'joined',
    date: joinedAt,
  };
  if (!member.pathway || !member.startedProject || !member.startingLevel) {
    return [joined];
  }
  return [
    joined,
    {
      id: `${member.id}-first-project`,
      memberId: member.id,
      type: 'project-started',
      date: member.pathwayStartedAt ?? joinedAt,
      projectName: member.startedProject,
      level: member.startingLevel,
      pathway: member.pathway,
    },
  ];
}

export interface MemberStats {
  speechesGiven: number;
  projectsCompleted: number;
  meetingsAttended: number;
  rolesTaken: number;
  joinedAt: string;
  /** Newest active project — a `project-started` with no matching `project-completed`. */
  currentProject: {
    name: string;
    level: Level;
    pathway: Pathway;
    startedDate: string;
  } | null;
  latestSpeech: {
    title: string;
    date: string;
    meetingNumber: number;
  } | null;
  /** The role the member has taken on the most times, or `null` if none yet. */
  favouriteRole: {
    role: MeetingRole;
    count: number;
  } | null;
}

/** Rolls a member's event stream up into the numbers the Progress tab shows.
 * Pure over its inputs so the same code can run here today and inside the Nest
 * service later — the local API layer is its only caller. */
export function computeMemberStats(
  rawEvents: HistoryEvent[],
  extras: MemberProfileExtras,
): MemberStats {
  const events = sortEvents(rawEvents);

  const completedProjects = new Set<string>();
  for (const event of events) {
    if (event.type === 'project-completed') completedProjects.add(event.projectName);
  }

  let currentProject: MemberStats['currentProject'] = null;
  for (const event of events) {
    if (event.type !== 'project-started') continue;
    if (completedProjects.has(event.projectName)) continue;
    currentProject = {
      name: event.projectName,
      level: event.level,
      pathway: event.pathway,
      startedDate: event.date,
    };
    break;
  }

  let latestSpeech: MemberStats['latestSpeech'] = null;
  for (const event of events) {
    if (event.type === 'speech-given') {
      latestSpeech = {
        title: event.title,
        date: event.date,
        meetingNumber: event.meetingNumber,
      };
      break;
    }
  }

  const speechesGiven = events.reduce(
    (count, event) => (event.type === 'speech-given' ? count + 1 : count),
    0,
  );

  const roleCounts = new Map<MeetingRole, number>();
  for (const event of events) {
    if (event.type !== 'role-taken') continue;
    roleCounts.set(event.role, (roleCounts.get(event.role) ?? 0) + 1);
  }
  const rolesTaken = Array.from(roleCounts.values()).reduce((sum, n) => sum + n, 0);
  let favouriteRole: MemberStats['favouriteRole'] = null;
  for (const [role, count] of roleCounts) {
    if (!favouriteRole || count > favouriteRole.count) {
      favouriteRole = { role, count };
    }
  }

  return {
    speechesGiven,
    projectsCompleted: completedProjects.size,
    meetingsAttended: extras.meetingsAttended,
    rolesTaken,
    joinedAt: extras.joinedAt,
    currentProject,
    latestSpeech,
    favouriteRole,
  };
}
