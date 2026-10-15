/// Dart port of `packages/access` (`grants.ts` + `can.ts`). Keep it in lock
/// step with the TypeScript source: the API enforces the same rules, and this
/// copy only decides what the UI shows. When the TS grants change, change
/// them here and in `test/access_test.dart`.
library;

enum Act { create, read, update, delete }

enum Scope { own, club, area, division, district, global }

const clubRoles = <String>[
  'Guest', 'Member', 'SergeantAtArms', 'President', 'Treasurer', 'VPMembership',
  'VPPR', 'VPEducation', 'IPP', 'Secretary', 'ClubAdmin', 'Moderator',
];

/// Labels the web shows for each club role.
const clubRoleLabels = <String, String>{
  'Guest': 'Guest',
  'Member': 'Member',
  'SergeantAtArms': 'SAA',
  'President': 'President',
  'Treasurer': 'Treasurer',
  'VPMembership': 'VPM',
  'VPPR': 'VPPR',
  'VPEducation': 'VPE',
  'IPP': 'IPP',
  'Secretary': 'Secretary',
  'ClubAdmin': 'Club Admin',
  'Moderator': 'Moderator',
};

String roleLabel(String role) => clubRoleLabels[role] ?? role;

class Grant {
  const Grant(this.resource, this.action, this.scope);
  final String resource;
  final Act action;
  final Scope scope;
}

List<Grant> _rw(String r, [Scope s = Scope.club]) =>
    [for (final a in Act.values) Grant(r, a, s)];
List<Grant> _r(String r, [Scope s = Scope.club]) => [Grant(r, Act.read, s)];
List<Grant> _rmu(String r, [Scope s = Scope.club]) =>
    [Grant(r, Act.read, s), Grant(r, Act.update, s)];
List<Grant> _cr(String r, [Scope s = Scope.club]) =>
    [Grant(r, Act.create, s), Grant(r, Act.read, s)];

final _clubBaseRead = [
  for (final r in const [
    'club', 'meeting', 'meetingRole', 'member', 'library', 'guest', 'guestLog',
    'education', 'checklist', 'tableTopic', 'attendance', 'inventory',
    'transaction', 'budget', 'dues', 'activityLog', 'task',
  ])
    Grant(r, Act.read, Scope.club),
];

const _ownTaskAccess = [
  Grant('task', Act.read, Scope.own),
  Grant('task', Act.update, Scope.own),
  Grant('evaluation', Act.read, Scope.own),
  Grant('speechRequest', Act.read, Scope.own),
  Grant('speechRequest', Act.create, Scope.own),
];

const _officerTaskAccess = [
  Grant('task', Act.create, Scope.club),
  Grant('task', Act.delete, Scope.own),
];

const _ownEducation = [Grant('education', Act.update, Scope.own)];

final List<Grant> _member = [
  ..._clubBaseRead, ..._ownTaskAccess, ..._ownEducation,
  ..._rw('meeting'), ..._rw('meetingRole'),
];

final List<Grant> _clubAdmin = [
  ..._rw('club'), ..._rw('member'), ..._rw('memberRole'), ..._rw('memberPermission'),
  ..._rw('meeting'), ..._rw('meetingRole'), ..._rw('checklist'), ..._rw('tableTopic'),
  ..._rw('attendance'), ..._rw('education'), ..._rw('guest'), ..._rw('guestLog'),
  ..._rw('library'), ..._rw('inventory'), ..._rw('transaction'), ..._rw('budget'),
  ..._rw('dues'), ..._rw('evaluation'), ..._rw('speechRequest'), ..._rw('task'),
  ..._rw('invite'), ..._rw('joinRequest'), ..._r('activityLog'), ..._r('report'),
];

final Map<String, List<Grant>> clubRoleGrants = {
  'Guest': const [Grant('club', Act.read, Scope.club)],
  'Member': _member,
  'SergeantAtArms': [
    ..._member, ..._officerTaskAccess, ..._rw('checklist'), ..._rw('inventory'), ..._rw('attendance'),
  ],
  'President': [
    ..._member, ..._officerTaskAccess, ..._rw('meeting'), ..._rw('meetingRole'),
    ..._rw('tableTopic'), ..._rw('attendance'), ..._rmu('education'), ..._r('activityLog'), ..._r('report'),
  ],
  'Treasurer': [..._member, ..._officerTaskAccess, ..._rw('transaction'), ..._rw('budget'), ..._rw('dues')],
  'VPMembership': [..._member, ..._officerTaskAccess, ..._rw('guest'), ..._rw('guestLog'), ..._cr('invite')],
  'VPPR': [..._member, ..._officerTaskAccess, ..._rw('library')],
  'VPEducation': [
    ..._member, ..._rw('education'), ..._rw('meeting'), ..._rw('meetingRole'), ..._rw('tableTopic'),
    ..._rw('speechRequest'), ..._rw('evaluation'), ..._rw('task'),
  ],
  'IPP': [..._member, ..._officerTaskAccess, ..._r('report'), ..._r('activityLog')],
  'Secretary': [..._member, ..._officerTaskAccess, ..._rw('meeting'), ..._rw('meetingRole'), ..._rw('attendance')],
  'ClubAdmin': _clubAdmin,
  'Moderator': _clubAdmin,
};

const _directorReadResources = [
  'club', 'member', 'meeting', 'meetingRole', 'checklist', 'tableTopic', 'attendance',
  'guest', 'guestLog', 'library', 'inventory', 'transaction', 'budget', 'dues',
  'education', 'evaluation', 'speechRequest', 'task', 'activityLog', 'report',
];

List<Grant> _director(Scope s) => [
      Grant('orgUnit', Act.read, s),
      Grant('orgUnit', Act.update, s),
      Grant('club', Act.update, s),
      for (final r in _directorReadResources) Grant(r, Act.read, s),
    ];

final Map<String, List<Grant>> orgRoleGrants = {
  'AreaDirector': _director(Scope.area),
  'DivisionDirector': _director(Scope.division),
  'DistrictDirector': _director(Scope.district),
};

class Lineage {
  const Lineage({this.clubId, this.areaId, this.divisionId, this.districtId});
  final String? clubId;
  final String? areaId;
  final String? divisionId;
  final String? districtId;

  factory Lineage.fromJson(Map<String, dynamic>? j) => Lineage(
        clubId: j?['clubId'] as String?,
        areaId: j?['areaId'] as String?,
        divisionId: j?['divisionId'] as String?,
        districtId: j?['districtId'] as String?,
      );
}

sealed class Assignment {
  const Assignment();
}

class ClubAssignment extends Assignment {
  const ClubAssignment({
    required this.clubId,
    required this.membershipId,
    required this.roles,
    this.overrides = const {},
    this.lineage = const Lineage(),
  });
  final String clubId;
  final String membershipId;
  final List<String> roles;
  final Map<String, String> overrides;
  final Lineage lineage;
}

class OrgAssignment extends Assignment {
  const OrgAssignment({
    required this.unitType,
    required this.unitId,
    required this.role,
    this.lineage = const Lineage(),
  });
  final String unitType; // area | division | district
  final String unitId;
  final String role;
  final Lineage lineage;
}

class GlobalAssignment extends Assignment {
  const GlobalAssignment();
}

class Target {
  const Target({
    this.clubId,
    this.areaId,
    this.divisionId,
    this.districtId,
    this.ownerMembershipId,
    this.lineage,
  });
  final String? clubId;
  final String? areaId;
  final String? divisionId;
  final String? districtId;
  final String? ownerMembershipId;
  final Lineage? lineage;
}

class PermissionSubject {
  const PermissionSubject({required this.userId, required this.assignments, this.contextLineage});
  final String userId;
  final List<Assignment> assignments;
  final Lineage? contextLineage;
}

String overrideKey(String resource, Act action) => '$resource:${action.name}';

Target? _enrich(Target? t, Lineage? l) {
  if (t == null || l == null) return t;
  return Target(
    clubId: t.clubId,
    areaId: t.areaId ?? l.areaId,
    divisionId: t.divisionId ?? l.divisionId,
    districtId: t.districtId ?? l.districtId,
    ownerMembershipId: t.ownerMembershipId,
    lineage: t.lineage,
  );
}

bool _anchorContains(Assignment a, Target? t) {
  switch (a) {
    case GlobalAssignment():
      return true;
    case ClubAssignment():
      if (t?.clubId == null) return false;
      return t!.clubId == a.clubId;
    case OrgAssignment():
      final l = t?.lineage;
      switch (a.unitType) {
        case 'area':
          return t?.areaId == a.unitId || l?.areaId == a.unitId;
        case 'division':
          return t?.divisionId == a.unitId || l?.divisionId == a.unitId;
        case 'district':
          return t?.districtId == a.unitId || l?.districtId == a.unitId;
      }
      return false;
  }
}

Scope _scopeAtMost(Grant g, Assignment a) {
  switch (a) {
    case GlobalAssignment():
      return g.scope;
    case ClubAssignment():
      return g.scope == Scope.own ? Scope.own : Scope.club;
    case OrgAssignment():
      final anchor = Scope.values.byName(a.unitType);
      return g.scope.index < anchor.index ? g.scope : anchor;
  }
}

List<Grant> _grantsFor(Assignment a) => switch (a) {
      GlobalAssignment() => const [],
      ClubAssignment() => [for (final r in a.roles) ...?clubRoleGrants[r]],
      OrgAssignment() => orgRoleGrants[a.role] ?? const [],
    };

bool _matches(Grant g, Act action, String resource, Assignment a, Target? t) {
  if (g.resource != resource || g.action != action) return false;
  if (_scopeAtMost(g, a) == Scope.own) {
    if (a is! ClubAssignment) return false;
    if (t?.ownerMembershipId == null) return false;
    return t!.ownerMembershipId == a.membershipId;
  }
  return true;
}

bool can(PermissionSubject subject, Act action, String resource, [Target? target]) {
  if (subject.assignments.any((a) => a is GlobalAssignment)) return true;
  final t = _enrich(target, subject.contextLineage);
  final matching = subject.assignments.where((a) => _anchorContains(a, t)).toList();
  if (matching.isEmpty) return false;

  Assignment? allow;
  Assignment? deny;
  for (final a in matching) {
    var allowed = _grantsFor(a).any((g) => _matches(g, action, resource, a, t));
    if (a is ClubAssignment) {
      final o = a.overrides[overrideKey(resource, action)];
      if (o == 'allow') allowed = true;
      if (o == 'deny') {
        deny = a;
        continue;
      }
    }
    if (allowed) allow ??= a;
  }
  if (deny != null) return false;
  return allow != null;
}
