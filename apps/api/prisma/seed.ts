/**
 * Toastly seed — hits the volume the app is meant to hold up at (100 clubs,
 * 1,000 users, ~2,500 memberships). Optimised per §5.7 of the plan so it
 * completes in <60s against Neon free-tier:
 *
 * - One argon2 hash for a shared dev password, reused for every user.
 *   Naive `argon2.hash` on 1,000 users = 100s on its own.
 * - `createMany` with `skipDuplicates` instead of a `create` per row.
 * - IDs pre-generated in JS (`cuid2`) so child tables can be inserted
 *   without reading parent rows back from the DB.
 * - Chunked at 5,000 rows per statement to stay under Neon's parameter cap.
 *
 * Run with `pnpm --filter @toastly/api seed` after `prisma migrate dev`.
 */

import { createId } from '@paralleldrive/cuid2';
import { type Prisma, PrismaClient } from '@prisma/client';
import { hash as argon2Hash } from 'argon2';

const prisma = new PrismaClient();

const CHUNK_SIZE = 5_000;

// Deliberately small English wordlists — names should look plausible without
// pulling in a dependency. Combined they give ~10,000 distinct name pairs.
const FIRST_NAMES = [
  'Aisha',
  'Marcus',
  'Priya',
  'Daniel',
  'Sophia',
  'Nathan',
  'Yara',
  'Liam',
  'Grace',
  'Rafael',
  'Hannah',
  'Kenji',
  'Zara',
  'Ethan',
  'Riley',
  'Amelia',
  'Tomas',
  'Nadia',
  'Oliver',
  'Chloe',
  'Idris',
  'Mira',
  'Jonas',
  'Elena',
  'Kwame',
  'Sana',
  'Felix',
  'Aya',
  'Noor',
  'Diego',
];
const LAST_NAMES = [
  'Patel',
  'Chen',
  'Sharma',
  'Ortiz',
  'Nakamura',
  'Brooks',
  'Ibrahim',
  'Reeves',
  'Okafor',
  'Mendoza',
  'Klein',
  'Watanabe',
  'Ahmed',
  'Kowalski',
  'Novak',
  'Fischer',
  'Rivera',
  'Haddad',
  'Bennett',
  'Dubois',
  'Sato',
  'Kim',
  'Nguyen',
  'Silva',
  'Rossi',
  'Andersen',
  'Cohen',
  'Park',
  'Wagner',
  'Diaz',
];
const CLUB_ADJECTIVES = [
  'Sunrise',
  'Riverside',
  'Downtown',
  'Harbor',
  'Summit',
  'Meadow',
  'Beacon',
  'Oakwood',
  'Redwood',
  'Silverpeak',
  'Northshore',
  'Cedar',
  'Highland',
  'Aurora',
  'Willow',
  'Cascade',
  'Crescent',
  'Ironwood',
  'Nightingale',
  'Verdant',
];
const CLUB_NOUNS = [
  'Speakers',
  'Toastmasters',
  'Voices',
  'Podium',
  'Orators',
  'Communicators',
  'Rhetors',
  'Storytellers',
  'Lyceum',
  'Assembly',
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function pickTwo<T>(arr: readonly T[], i: number): [T, T] {
  return [arr[i % arr.length], arr[(i * 7 + 3) % arr.length]];
}

async function chunked<T>(rows: T[], size: number, run: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await run(rows.slice(i, i + size));
  }
}

/** Reads `SUPER_ADMIN_PHONE` + `SUPER_ADMIN_PASSWORD` from the env and
 * upserts a super admin User by phone. Runs before the dev-data seed so
 * the admin survives the wipe. A missing env is a hard error — a silent
 * skip would leave prod/staging without an admin, which is worse than
 * failing loudly. */
async function bootstrapSuperAdmin(): Promise<void> {
  const phone = process.env.SUPER_ADMIN_PHONE?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!phone || !password) {
    throw new Error(
      'SUPER_ADMIN_PHONE and SUPER_ADMIN_PASSWORD must be set (see apps/api/.env.example)',
    );
  }
  const canonicalPhone = phone.replace(/[\s-]/g, '');
  const passwordHash = await argon2Hash(password);
  const user = await prisma.user.upsert({
    where: { phone: canonicalPhone },
    create: {
      id: createId(),
      phone: canonicalPhone,
      email: null,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'active',
      isSuperAdmin: true,
    },
    update: {
      passwordHash,
      status: 'active',
      isSuperAdmin: true,
    },
    select: { id: true, phone: true },
  });
  console.log(`[seed] super admin ready — phone=${user.phone}`);
}

async function main() {
  console.log('[seed] wiping existing rows…');
  // Order matters — children first, parents last, so no dangling FKs.
  await prisma.$transaction([
    prisma.joinRequest.deleteMany(),
    prisma.invite.deleteMany(),
    prisma.orgAssignment.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.club.deleteMany(),
    prisma.area.deleteMany(),
    prisma.division.deleteMany(),
    prisma.district.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // -------------------------------------------- org tree: 4 / 12 / 40 --
  // Small tree that keeps district/division/area drill-in visible without
  // dwarfing the club count. Every club sits under exactly one Area.
  console.log('[seed] org tree');

  const districts = Array.from({ length: 4 }, (_, i) => ({
    id: createId(),
    name: `District ${88 + i}`,
    code: `D${88 + i}`,
  }));
  await prisma.district.createMany({ data: districts });

  const divisions = districts.flatMap((district, di) =>
    Array.from({ length: 3 }, (_, dvi) => ({
      id: createId(),
      districtId: district.id,
      name: `Division ${String.fromCharCode(65 + di * 3 + dvi)}`,
    })),
  );
  await prisma.division.createMany({ data: divisions });

  const areas = divisions.flatMap((division) =>
    Array.from({ length: 4 }, (_, ai) => ({
      id: createId(),
      divisionId: division.id,
      districtId: division.districtId,
      name: `Area ${division.name.split(' ')[1]}${ai + 1}`,
    })),
  );
  await prisma.area.createMany({ data: areas });

  // -------------------------------------------- users: 1,000 --
  console.log('[seed] users');
  // One argon2 hash reused for every seed user. Real signups run their own
  // hash — this shortcut only lives inside the seed script.
  const sharedPasswordHash = await argon2Hash('toastly-dev-2026');

  const users: Prisma.UserCreateManyInput[] = Array.from({ length: 1_000 }, (_, i) => {
    const [first, last] = pickTwo(FIRST_NAMES, i);
    const noise = i.toString(36);
    // Synthetic +99 test-range phones — real users get their own via the
    // register form. Padding to 10 digits keeps a fixed E.164-ish shape.
    const phone = `+99${(1000000000 + i).toString()}`;
    return {
      id: createId(),
      phone,
      email: `${first.toLowerCase()}.${last.toLowerCase()}.${noise}@toastly.test`,
      passwordHash: sharedPasswordHash,
      firstName: first,
      lastName: last,
      status: 'active',
      // The super admin comes from `bootstrapSuperAdmin()` below — dev
      // seed users are all plain accounts so a fresh seed leaves the
      // env-driven admin as the only global-scope operator.
      isSuperAdmin: false,
      emailVerifiedAt: new Date(),
    };
  });
  await chunked(users, CHUNK_SIZE, (chunk) =>
    prisma.user.createMany({ data: chunk, skipDuplicates: true }),
  );

  // -------------------------------------------- clubs: 100 --
  console.log('[seed] clubs');
  const clubs: Prisma.ClubCreateManyInput[] = Array.from({ length: 100 }, (_, i) => {
    const area = pick(areas, i);
    const [adjective, noun] = [pick(CLUB_ADJECTIVES, i), pick(CLUB_NOUNS, i * 3)];
    return {
      id: createId(),
      areaId: area.id,
      divisionId: area.divisionId,
      districtId: area.districtId,
      name: `${adjective} ${noun}`,
      slug: `${adjective.toLowerCase()}-${noun.toLowerCase()}-${i}`,
      clubNumber: `1${(100000 + i * 173).toString().slice(-6)}`,
      directoryStatus: 'active',
      lifecycle: 'active',
      joinPolicy: 'request',
    };
  });
  await chunked(clubs, CHUNK_SIZE, (chunk) =>
    prisma.club.createMany({ data: chunk, skipDuplicates: true }),
  );

  // -------------------------------------------- memberships: ~2,500 --
  // Every user has 2–3 memberships on average. ~15% of users hold 2+ so
  // multi-club membership is meaningfully exercised, matching the plan.
  console.log('[seed] memberships');
  const memberships: Prisma.MembershipCreateManyInput[] = [];
  users.forEach((user, i) => {
    const primaryClub = pick(clubs, i);
    const memberRoles = i < 100 ? (['President'] as const) : (['Member'] as const);
    memberships.push({
      id: createId(),
      clubId: primaryClub.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: [...memberRoles],
      isClubAdmin: i < 100, // Every club has exactly one Club Admin.
      status: 'active',
      grantOverrides: {},
    });

    // ~15% of users get a second membership somewhere else in the tree.
    if (i % 7 === 0) {
      const secondaryClub = pick(clubs, i * 3 + 11);
      if (secondaryClub.id !== primaryClub.id) {
        memberships.push({
          id: createId(),
          clubId: secondaryClub.id,
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: ['Member'],
          isClubAdmin: false,
          status: 'active',
          grantOverrides: {},
        });
      }
    }
  });
  await chunked(memberships, CHUNK_SIZE, (chunk) =>
    prisma.membership.createMany({ data: chunk, skipDuplicates: true }),
  );

  // -------------------------------------------- org assignments --
  // A handful of directors so the switcher and scope filters have something
  // real to resolve against.
  console.log('[seed] org assignments');
  const orgAssignments: Prisma.OrgAssignmentCreateManyInput[] = [];
  areas.forEach((area, i) => {
    orgAssignments.push({
      id: createId(),
      userId: users[i % users.length]!.id,
      role: 'AreaDirector',
      unitType: 'area',
      areaId: area.id,
    });
  });
  divisions.forEach((division, i) => {
    orgAssignments.push({
      id: createId(),
      userId: users[(i * 13) % users.length]!.id,
      role: 'DivisionDirector',
      unitType: 'division',
      divisionId: division.id,
    });
  });
  districts.forEach((district, i) => {
    orgAssignments.push({
      id: createId(),
      userId: users[(i * 37) % users.length]!.id,
      role: 'DistrictDirector',
      unitType: 'district',
      districtId: district.id,
    });
  });
  await chunked(orgAssignments, CHUNK_SIZE, (chunk) =>
    prisma.orgAssignment.createMany({ data: chunk, skipDuplicates: true }),
  );

  // Bootstrap runs LAST so the wipe above can't take it out. Idempotent
  // upsert by phone — running the seed twice never duplicates the admin.
  console.log('[seed] bootstrap super admin');
  await bootstrapSuperAdmin();

  console.log(
    `[seed] done — ${districts.length} districts, ${divisions.length} divisions, ` +
      `${areas.length} areas, ${clubs.length} clubs, ${users.length} users, ` +
      `${memberships.length} memberships, ${orgAssignments.length} org assignments`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
