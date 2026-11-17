/**
 * Demo club for store screenshots and app-review sign-in.
 *
 * Creates one self-contained club ("Lakeside Speakers Club") with fictional
 * members, guests, past meetings and one upcoming meeting with every role
 * filled. Re-running replaces that club (matched by slug) and nothing else.
 *
 * Only the demo login has a phone number. Every other member and guest has
 * none, so publishing a meeting or assigning a role in the demo club can't
 * send a WhatsApp message to anyone.
 *
 *   DEMO_PHONE=01XXXXXXXXX DEMO_PASSWORD=... \
 *     pnpm --filter @toastly/api exec dotenv -e ../../.env -- \
 *     ts-node --transpile-only prisma/demo-club.ts
 */

import { randomBytes } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { type ClubRole, PrismaClient } from '@prisma/client';
import { hash as argon2Hash } from 'argon2';

const prisma = new PrismaClient();

const SLUG = 'lakeside-speakers-demo';
const token = () => randomBytes(16).toString('base64url');

// Bangladesh is UTC+6 with no DST: 19:00 local = 13:00Z.
function fridayEvening(weeksFromNext: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 0));
  const toFriday = (5 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + toFriday + weeksFromNext * 7);
  return d;
}

type M = {
  first: string;
  last: string;
  roles: ClubRole[];
  pathway?: string;
  level?: number;
  project?: string;
};

const MEMBERS: M[] = [
  { first: 'Nusrat', last: 'Jahan', roles: ['President'], pathway: 'Dynamic Leadership', level: 3 },
  {
    first: 'Tanvir',
    last: 'Ahmed',
    roles: ['VPEducation'],
    pathway: 'Presentation Mastery',
    level: 2,
  },
  {
    first: 'Farhana',
    last: 'Islam',
    roles: ['VPMembership'],
    pathway: 'Persuasive Influence',
    level: 2,
  },
  { first: 'Rafiq', last: 'Hasan', roles: ['VPPR'], pathway: 'Engaging Humor', level: 1 },
  {
    first: 'Sadia',
    last: 'Rahman',
    roles: ['Secretary'],
    pathway: 'Visionary Communication',
    level: 2,
  },
  {
    first: 'Imran',
    last: 'Chowdhury',
    roles: ['Treasurer'],
    pathway: 'Team Collaboration',
    level: 1,
  },
  {
    first: 'Mehnaz',
    last: 'Karim',
    roles: ['SergeantAtArms'],
    pathway: 'Motivational Strategies',
    level: 1,
  },
  { first: 'Arif', last: 'Hossain', roles: ['Member'], pathway: 'Presentation Mastery', level: 4 },
  { first: 'Tasnim', last: 'Akter', roles: ['Member'], pathway: 'Effective Coaching', level: 1 },
  { first: 'Shafiq', last: 'Uddin', roles: ['Member'], pathway: 'Innovative Planning', level: 2 },
  {
    first: 'Lamia',
    last: 'Siddique',
    roles: ['Member'],
    pathway: 'Strategic Relationships',
    level: 1,
  },
  {
    first: 'Nabil',
    last: 'Mahmud',
    roles: ['Member'],
    pathway: 'Leadership Development',
    level: 3,
  },
  { first: 'Rumana', last: 'Begum', roles: ['Member'] },
  { first: 'Kamrul', last: 'Alam', roles: ['Member'], pathway: 'Dynamic Leadership', level: 1 },
];

const GUESTS: Array<[string, string, string, string?]> = [
  ['Ayesha', 'Noor', 'interested', 'Tanvir Ahmed'],
  ['Mahir', 'Faisal', 'joined-meetings', 'Nusrat Jahan'],
  ['Sumaiya', 'Haque', 'new'],
  ['Zubair', 'Rashid', 'contacted', 'Farhana Islam'],
  ['Priyanka', 'Das', 'new', 'Arif Hossain'],
  ['Omar', 'Faruk', 'interested'],
  ['Jannat', 'Ferdous', 'contacted', 'Sadia Rahman'],
  ['Rakib', 'Hassan', 'new'],
];

const PAST_THEMES: Array<[string, string, string, string, string]> = [
  [
    'The Courage to Begin',
    'Audacious',
    'Adjective',
    'Showing a willingness to take bold risks',
    'Her audacious plan surprised everyone.',
  ],
  [
    'Stories That Stay',
    'Vivid',
    'Adjective',
    'Producing powerful feelings or strong, clear images in the mind',
    'He painted a vivid picture of his village.',
  ],
  [
    'Listening First',
    'Attentive',
    'Adjective',
    'Paying close attention to something',
    'An attentive audience makes a better speaker.',
  ],
  [
    'Change Makers',
    'Catalyst',
    'Noun',
    'A person or thing that precipitates an event or change',
    'The workshop was a catalyst for new ideas.',
  ],
  [
    'Small Wins',
    'Momentum',
    'Noun',
    'The strength or force gained by motion or a series of events',
    'Each speech added to her momentum.',
  ],
];

async function main() {
  const phone = process.env.DEMO_PHONE?.replace(/[\s-]/g, '');
  const password = process.env.DEMO_PASSWORD;
  if (!phone || !password) throw new Error('Set DEMO_PHONE and DEMO_PASSWORD');

  const existing = await prisma.club.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (existing) await prisma.club.delete({ where: { id: existing.id } }); // cascades to its rows

  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      id: createId(),
      phone,
      passwordHash: await argon2Hash(password),
      firstName: 'Ayan',
      lastName: 'Kabir',
      status: 'active',
    },
    update: {
      passwordHash: await argon2Hash(password),
      status: 'active',
      mustChangePassword: false,
      firstName: 'Ayan',
      lastName: 'Kabir',
    },
  });

  const club = await prisma.club.create({
    data: {
      id: createId(),
      name: 'Lakeside Speakers Club',
      slug: SLUG,
      motto: 'Find your voice, lead with confidence',
      venueAddress: 'Community Hall, Road 12, Dhanmondi, Dhaka',
      bannerColor: '#1B2740',
      joinCode: token().slice(0, 8).toUpperCase(),
      joinPolicy: 'request',
    },
  });

  // The demo login is a club admin, so every screen (guests, admin) has content.
  const me = await prisma.membership.create({
    data: {
      id: createId(),
      clubId: club.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: ['Member'],
      isClubAdmin: true,
      status: 'active',
      pathway: 'Presentation Mastery',
      level: 2,
      pathwayStartedAt: new Date(Date.now() - 200 * 864e5),
    },
  });
  const members = [];
  for (const m of MEMBERS) {
    members.push(
      await prisma.membership.create({
        data: {
          id: createId(),
          clubId: club.id,
          firstName: m.first,
          lastName: m.last,
          roles: m.roles,
          isClubAdmin: m.roles.includes('President'),
          status: 'active',
          pathway: m.pathway ?? null,
          level: m.level ?? null,
          pathwayStartedAt: m.pathway
            ? new Date(Date.now() - (100 + members.length * 20) * 864e5)
            : null,
        },
      }),
    );
  }
  const by = (first: string) => members.find((m) => m.firstName === first)!;

  const now = Date.now();
  for (const [i, [first, last, stage, invitedBy]] of GUESTS.entries()) {
    const visits = stage === 'joined-meetings' ? 2 : stage === 'new' ? 0 : 1;
    await prisma.prospect.create({
      data: {
        id: createId(),
        clubId: club.id,
        firstName: first,
        lastName: last,
        stage,
        invitedBy: invitedBy ?? null,
        visitCount: visits,
        firstVisit: visits ? new Date(now - (21 - i) * 864e5) : null,
        lastVisit: visits ? new Date(now - (7 - (i % 3)) * 864e5) : null,
        createdAt: new Date(now - (30 - i * 2) * 864e5),
      },
    });
  }

  const roleKeys = [
    'president',
    'sergeant-at-arms',
    'toastmaster',
    'general-evaluator',
    'table-topic-master',
    'table-topic-evaluator',
    'ah-counter',
    'timer',
    'grammarian',
  ];

  async function meeting(
    num: number,
    when: Date,
    theme: string,
    word: [string, string, string, string],
    cast: string[],
    speakers: Array<[string, string, string, string, number]>,
  ) {
    const mt = await prisma.meeting.create({
      data: {
        id: createId(),
        clubId: club.id,
        meetingNumber: num,
        dateTime: when,
        theme,
        status: 'published',
        word: word[0],
        wordPartOfSpeech: word[1],
        wordMeaning: word[2],
        wordExample: word[3],
        shareToken: token(),
        announcedAt: new Date(when.getTime() - 5 * 864e5),
      },
    });
    for (const [i, key] of roleKeys.entries()) {
      const holder = cast[i] === 'ME' ? me : by(cast[i]!);
      await prisma.meetingRoleAssignment.create({
        data: {
          id: createId(),
          clubId: club.id,
          meetingId: mt.id,
          roleKey: key,
          membershipId: holder.id,
        },
      });
    }
    for (const [i, [speaker, evaluator, title, project, mins]] of speakers.entries()) {
      await prisma.meetingSpeaker.create({
        data: {
          id: createId(),
          clubId: club.id,
          meetingId: mt.id,
          order: i + 1,
          status: 'confirmed',
          membershipId: speaker === 'ME' ? me.id : by(speaker).id,
          evaluatorMembershipId: by(evaluator).id,
          title,
          duration: mins,
          pathway: speaker === 'ME' ? me.pathway : by(speaker).pathway,
          project,
        },
      });
    }
    return mt;
  }

  // Upcoming: next Friday, fully cast.
  await meeting(
    61,
    fridayEvening(0),
    'Finding Your Voice',
    [
      'Resilient',
      'Adjective',
      'Able to recover quickly from difficulties',
      'A resilient speaker turns nerves into energy.',
    ],
    ['Nusrat', 'Mehnaz', 'Tanvir', 'Arif', 'Farhana', 'Nabil', 'Tasnim', 'ME', 'Sadia'],
    [
      ['Rafiq', 'Arif', 'Laughing at Myself', 'Ice Breaker', 6],
      ['Shafiq', 'Nabil', 'Planning a Rooftop Garden', 'Writing a Speech with Purpose', 7],
      [
        'Lamia',
        'Tanvir',
        'The Bridge Between Two Cities',
        'Introduction to Vocal Variety and Body Language',
        7,
      ],
      ['Kamrul', 'Farhana', 'Why I Run at Dawn', 'Ice Breaker', 6],
    ],
  );

  // History: five previous Fridays.
  const casts = [
    ['Nusrat', 'Imran', 'Arif', 'Tanvir', 'Sadia', 'Kamrul', 'Lamia', 'Rafiq', 'Nabil'],
    ['Nusrat', 'Mehnaz', 'Farhana', 'Nabil', 'Arif', 'Tasnim', 'Shafiq', 'Imran', 'Tanvir'],
    ['Nusrat', 'Kamrul', 'Nabil', 'Sadia', 'Tanvir', 'Rafiq', 'ME', 'Lamia', 'Farhana'],
    ['Nusrat', 'Mehnaz', 'Sadia', 'Arif', 'Imran', 'Shafiq', 'Rafiq', 'Tasnim', 'Nabil'],
    ['Nusrat', 'Imran', 'Tanvir', 'Farhana', 'Nabil', 'Arif', 'Kamrul', 'Shafiq', 'Lamia'],
  ];
  for (const [i, [theme, ...word]] of PAST_THEMES.entries()) {
    await meeting(
      60 - i,
      fridayEvening(-(i + 1)),
      theme,
      word as [string, string, string, string],
      casts[i]!,
      [
        ['Arif', 'Tanvir', 'What the River Taught Me', 'Researching and Presenting', 7],
        ['ME', 'Nabil', 'My First Job Interview', 'Ice Breaker', 6],
      ],
    );
  }

  console.log(
    `[demo] ${club.name}: ${MEMBERS.length + 1} members, ${GUESTS.length} guests, 6 meetings — login ${phone}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
