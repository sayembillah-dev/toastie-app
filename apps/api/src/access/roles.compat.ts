import type {
  ClubRole as PrismaClubRole,
  OrgRole as PrismaOrgRole,
  OrgUnitType as PrismaOrgUnitType,
} from '@prisma/client';
import { ClubRole, OrgRole, OrgUnitType } from '@prisma/client';
import type {
  ClubRole as PackageClubRole,
  OrgRole as PackageOrgRole,
  OrgUnitType as PackageOrgUnitType,
} from '@toastly/access';
import { CLUB_ROLES, ORG_ROLES, ORG_UNIT_TYPES } from '@toastly/access';

/**
 * Compile-time drift check between Prisma enums and `@toastly/access` unions.
 *
 * The permission engine is a pure package that has no idea what the DB
 * schema is. If someone renames `SergeantAtArms` in one place and forgets
 * the other, the engine returns a role decision the DB can never store —
 * which surfaces as a runtime 403 in the wrong place, days later. Instead,
 * these type-level checks make a rename fail `tsc`.
 *
 * The mapped types below force each Prisma enum member to appear in the
 * package's union, and vice versa. TypeScript resolves them at compile
 * time; nothing runs at runtime. The `_` prefixes silence unused-var lint.
 */
type _ClubRoleMatchesPackage = {
  [K in PrismaClubRole]: K extends PackageClubRole ? true : never;
};
type _PackageMatchesClubRole = {
  [K in PackageClubRole]: K extends PrismaClubRole ? true : never;
};
type _OrgRoleMatchesPackage = {
  [K in PrismaOrgRole]: K extends PackageOrgRole ? true : never;
};
type _PackageMatchesOrgRole = {
  [K in PackageOrgRole]: K extends PrismaOrgRole ? true : never;
};
type _OrgUnitTypeMatchesPackage = {
  [K in PrismaOrgUnitType]: K extends PackageOrgUnitType ? true : never;
};
type _PackageMatchesOrgUnitType = {
  [K in PackageOrgUnitType]: K extends PrismaOrgUnitType ? true : never;
};

/** Runtime sanity check backing up the type-level one — catches a mismatch
 * if Prisma's generated enum has a member the union forgot (or vice
 * versa). Runs at module load and throws before Nest boots the app. */
function assertNoDrift(): void {
  const prismaClub = new Set<string>(Object.values(ClubRole));
  const packageClub = new Set<string>(CLUB_ROLES);
  for (const k of prismaClub) {
    if (!packageClub.has(k)) throw new Error(`ClubRole drift: Prisma has ${k}, package doesn't`);
  }
  for (const k of packageClub) {
    if (!prismaClub.has(k)) throw new Error(`ClubRole drift: package has ${k}, Prisma doesn't`);
  }

  const prismaOrg = new Set<string>(Object.values(OrgRole));
  const packageOrg = new Set<string>(ORG_ROLES);
  for (const k of prismaOrg) {
    if (!packageOrg.has(k)) throw new Error(`OrgRole drift: Prisma has ${k}, package doesn't`);
  }
  for (const k of packageOrg) {
    if (!prismaOrg.has(k)) throw new Error(`OrgRole drift: package has ${k}, Prisma doesn't`);
  }

  const prismaUnit = new Set<string>(Object.values(OrgUnitType));
  const packageUnit = new Set<string>(ORG_UNIT_TYPES);
  for (const k of prismaUnit) {
    if (!packageUnit.has(k)) throw new Error(`OrgUnitType drift: Prisma has ${k}, package doesn't`);
  }
  for (const k of packageUnit) {
    if (!prismaUnit.has(k)) throw new Error(`OrgUnitType drift: package has ${k}, Prisma doesn't`);
  }
}

assertNoDrift();
