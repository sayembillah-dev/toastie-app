// Port of packages/access/src/can.test.ts — keep the two in lock step.
import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/core/access/access.dart';

ClubAssignment club({
  String clubId = 'club-a',
  String membershipId = 'm-1',
  List<String> roles = const ['Member'],
  Map<String, String> overrides = const {},
}) =>
    ClubAssignment(
      clubId: clubId,
      membershipId: membershipId,
      roles: roles,
      overrides: overrides,
      lineage: const Lineage(areaId: 'area-1', divisionId: 'div-1', districtId: 'dist-1'),
    );

PermissionSubject subject(List<Assignment> a, {Lineage? ctx}) =>
    PermissionSubject(userId: 'u-1', assignments: a, contextLineage: ctx);

void main() {
  group('scope clamping', () {
    test('a club role never reaches another club', () {
      final s = subject([club(roles: ['President'])]);
      expect(can(s, Act.update, 'meeting', const Target(clubId: 'club-a')), isTrue);
      expect(can(s, Act.update, 'meeting', const Target(clubId: 'club-b')), isFalse);
    });

    test('a club role is clamped to its own club even with matching lineage', () {
      final s = subject([club(roles: ['President'])]);
      expect(can(s, Act.read, 'meeting', const Target(clubId: 'club-b', lineage: Lineage(areaId: 'area-1'))), isFalse);
    });
  });

  group('deny precedence', () {
    test('an explicit deny override beats a role grant', () {
      final s = subject([club(roles: ['Treasurer'], overrides: {'transaction:delete': 'deny'})]);
      expect(can(s, Act.delete, 'transaction', const Target(clubId: 'club-a')), isFalse);
      expect(can(s, Act.update, 'transaction', const Target(clubId: 'club-a')), isTrue);
    });

    test('an explicit deny wins over another assignment that would allow', () {
      final s = subject([
        club(roles: ['Treasurer'], overrides: {'transaction:delete': 'deny'}),
        club(membershipId: 'm-2', roles: ['ClubAdmin']),
      ]);
      expect(can(s, Act.delete, 'transaction', const Target(clubId: 'club-a')), isFalse);
    });

    test('an allow override grants what the role does not', () {
      final s = subject([club(overrides: {'guest:create': 'allow'})]);
      expect(can(s, Act.create, 'guest', const Target(clubId: 'club-a')), isTrue);
      expect(can(s, Act.delete, 'guest', const Target(clubId: 'club-a')), isFalse);
    });
  });

  group('multi-assignment union', () {
    test('super admin bypass beats everything', () {
      final s = subject([const GlobalAssignment(), club(overrides: {'meeting:read': 'deny'})]);
      expect(can(s, Act.read, 'meeting', const Target(clubId: 'club-a')), isTrue);
    });

    test('unions grants across memberships in different clubs', () {
      final s = subject([
        club(roles: ['VPEducation']),
        club(clubId: 'club-b', membershipId: 'm-2', roles: ['Treasurer']),
      ]);
      expect(can(s, Act.update, 'education', const Target(clubId: 'club-a')), isTrue);
      expect(can(s, Act.update, 'education', const Target(clubId: 'club-b')), isFalse);
      expect(can(s, Act.update, 'transaction', const Target(clubId: 'club-b')), isTrue);
      expect(can(s, Act.update, 'transaction', const Target(clubId: 'club-a')), isFalse);
    });

    test('a Division Director sees clubs in their division', () {
      final s = subject([
        const OrgAssignment(unitType: 'division', unitId: 'div-1', role: 'DivisionDirector', lineage: Lineage(districtId: 'dist-1')),
      ]);
      expect(can(s, Act.read, 'club', const Target(clubId: 'club-x', lineage: Lineage(divisionId: 'div-1'))), isTrue);
      expect(can(s, Act.read, 'club', const Target(clubId: 'club-y', lineage: Lineage(divisionId: 'div-2'))), isFalse);
    });
  });

  group('own scope', () {
    test('a Member can read every task in their club', () {
      final s = subject([club(membershipId: 'm-8')]);
      expect(can(s, Act.read, 'task', const Target(clubId: 'club-a', ownerMembershipId: 'm-8')), isTrue);
      expect(can(s, Act.read, 'task', const Target(clubId: 'club-a', ownerMembershipId: 'm-2')), isTrue);
    });

    test("a Member can update their own task and not another member's", () {
      final s = subject([club(membershipId: 'm-8')]);
      expect(can(s, Act.update, 'task', const Target(clubId: 'club-a', ownerMembershipId: 'm-8')), isTrue);
      expect(can(s, Act.update, 'task', const Target(clubId: 'club-a', ownerMembershipId: 'm-2')), isFalse);
    });

    test("a Member can update their own pathway but not another member's", () {
      final s = subject([club(membershipId: 'm-8')]);
      expect(can(s, Act.update, 'education', const Target(clubId: 'club-a', ownerMembershipId: 'm-8')), isTrue);
      expect(can(s, Act.update, 'education', const Target(clubId: 'club-a', ownerMembershipId: 'm-2')), isFalse);
      expect(can(s, Act.update, 'education', const Target(clubId: 'club-a')), isFalse);
    });

    test("a VPE can update any member's pathway", () {
      final s = subject([club(membershipId: 'm-9', roles: ['VPEducation'])]);
      expect(can(s, Act.update, 'education', const Target(clubId: 'club-a', ownerMembershipId: 'm-2')), isTrue);
    });

    test('a plain Member cannot create a task; an officer can', () {
      expect(can(subject([club(membershipId: 'm-8')]), Act.create, 'task', const Target(clubId: 'club-a')), isFalse);
      expect(can(subject([club(membershipId: 'm-9', roles: ['President'])]), Act.create, 'task', const Target(clubId: 'club-a')),
          isTrue);
    });

    test('an officer can delete a task they created but not someone else’s', () {
      final s = subject([club(membershipId: 'm-9', roles: ['President'])]);
      expect(can(s, Act.delete, 'task', const Target(clubId: 'club-a', ownerMembershipId: 'm-9')), isTrue);
      expect(can(s, Act.delete, 'task', const Target(clubId: 'club-a', ownerMembershipId: 'm-2')), isFalse);
    });
  });

  group('director drill-in — contextLineage enrichment', () {
    const director = OrgAssignment(
      unitType: 'area',
      unitId: 'area-9',
      role: 'AreaDirector',
      lineage: Lineage(areaId: 'area-9', divisionId: 'div-9', districtId: 'dist-9'),
    );

    test("an Area Director's {clubId} target gets areaId from context", () {
      final s = subject([director],
          ctx: const Lineage(clubId: 'club-x', areaId: 'area-9', divisionId: 'div-9', districtId: 'dist-9'));
      expect(can(s, Act.read, 'meeting', const Target(clubId: 'club-x')), isTrue);
      expect(can(s, Act.read, 'library', const Target(clubId: 'club-x')), isTrue);
      expect(can(s, Act.update, 'meeting', const Target(clubId: 'club-x')), isFalse);
      expect(can(s, Act.create, 'meeting', const Target(clubId: 'club-x')), isFalse);
    });

    test('without context the org grant cannot match a bare club target', () {
      final s = subject([director]);
      expect(can(s, Act.read, 'meeting', const Target(clubId: 'club-y')), isFalse);
    });
  });

  group('app-level checks', () {
    test('a plain Member can edit meetings and roles but not guests', () {
      final s = subject([club()]);
      const t = Target(clubId: 'club-a');
      expect(can(s, Act.update, 'meeting', t), isTrue);
      expect(can(s, Act.update, 'meetingRole', t), isTrue);
      expect(can(s, Act.read, 'guest', t), isTrue);
      expect(can(s, Act.create, 'guest', t), isFalse);
    });

    test('VPM manages the guest pipeline', () {
      final s = subject([club(roles: ['Member', 'VPMembership'])]);
      const t = Target(clubId: 'club-a');
      expect(can(s, Act.create, 'guest', t), isTrue);
      expect(can(s, Act.update, 'guestLog', t), isTrue);
      expect(can(s, Act.create, 'invite', t), isTrue);
      expect(can(s, Act.delete, 'invite', t), isFalse);
    });
  });
}
