import '../core/bd_time.dart';
import 'models.dart';

String _s(Object? v) => v is String ? v : (v?.toString() ?? '');
String? _so(Object? v) => v is String && v.isNotEmpty ? v : null;
Json _m(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
int _i(Object? v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
List<T> _list<T>(Object? v, T Function(Json) f) =>
    v is List ? v.whereType<Map>().map((e) => f(Map<String, dynamic>.from(e))).toList() : <T>[];

// ───────────────────────── Attendance ─────────────────────────

class AttendanceGuest {
  AttendanceGuest({required this.id, required this.name, required this.present, this.guestId});
  final String id;
  final String name;
  final bool present;
  final String? guestId;
  factory AttendanceGuest.fromJson(Json j) =>
      AttendanceGuest(id: _s(j['id']), name: _s(j['name']), present: j['present'] == true, guestId: _so(j['guestId']));
}

// ───────────────────────── Voting ─────────────────────────

class VoteCandidate {
  VoteCandidate({required this.id, required this.name, this.membershipId, this.guestId, this.source});
  final String id;
  final String name;
  final String? membershipId;
  final String? guestId;
  final String? source;
  factory VoteCandidate.fromJson(Json j) => VoteCandidate(
        id: _s(j['id']),
        name: _s(j['name']),
        membershipId: _so(j['membershipId']),
        guestId: _so(j['guestId']),
        source: _so(j['source']),
      );
  Json toInput() => {
        'name': name,
        'membershipId': ?membershipId,
        'guestId': ?guestId,
      };
}

class VoteCategory {
  VoteCategory({required this.key, required this.label, required this.question, required this.candidates});
  final String key;
  final String label;
  final String question;
  final List<VoteCandidate> candidates;

  /// Best Table Topics Speaker tops itself up from the Timer and attendance;
  /// it stays fully editable like every other category.
  bool get isAuto => key == 'best-table-topics-speaker';

  factory VoteCategory.fromJson(Json j) => VoteCategory(
        key: _s(j['key']),
        label: _s(j['label']),
        question: _s(j['question']),
        candidates: _list(j['candidates'], VoteCandidate.fromJson),
      );
}

class VoteResultCategory {
  VoteResultCategory({required this.key, required this.label, required this.totalVotes, required this.candidates});
  final String key;
  final String label;
  final int totalVotes;
  final List<({String id, String name, int votes})> candidates;
  factory VoteResultCategory.fromJson(Json j) => VoteResultCategory(
        key: _s(j['key']),
        label: _s(j['label']),
        totalVotes: _i(j['totalVotes']),
        candidates: [
          for (final c in (j['candidates'] as List? ?? const []))
            if (c is Map) (id: _s(c['id']), name: _s(c['name']), votes: _i(c['votes'])),
        ]..sort((a, b) => b.votes.compareTo(a.votes)),
      );
}

class VoteResults {
  VoteResults({required this.totalBallots, required this.categories, required this.status});
  final int totalBallots;
  final List<VoteResultCategory> categories;
  final VotingStatus status;
  factory VoteResults.fromJson(Json j) => VoteResults(
        totalBallots: _i(j['totalBallots']),
        categories: _list(j['categories'], VoteResultCategory.fromJson),
        status: VotingStatus.fromJson(_m(j['status'])),
      );
}

/// Where the vote stands: `setup` (Start not pressed — ballots still count),
/// `open`, or `closed` (the ballot refuses votes). Mirrors the API's
/// `MeetingVotingStatusWire`.
enum VotingState {
  setup,
  open,
  closed;

  static VotingState parse(Object? v) => switch (v) {
        'open' => VotingState.open,
        'closed' => VotingState.closed,
        _ => VotingState.setup,
      };
}

class VotingStatus {
  VotingStatus({
    required this.state,
    required this.whatsappAvailable,
    required this.whatsappRecipients,
    this.linkSentAt,
    this.delivery,
  });
  final VotingState state;

  /// The WhatsApp sender is linked on the server.
  final bool whatsappAvailable;

  /// People checked in present with a WhatsApp number — who Start would
  /// message right now (0 once the link went out).
  final int whatsappRecipients;

  /// Set once the link went out; it is never sent twice.
  final DateTime? linkSentAt;

  /// Live send progress, or null (none sent, or the server restarted).
  final ({int queued, int sent, int failed})? delivery;

  factory VotingStatus.fromJson(Json j) {
    final wa = _m(j['whatsapp']);
    final d = wa['delivery'];
    return VotingStatus(
      state: VotingState.parse(j['state']),
      whatsappAvailable: wa['available'] == true,
      whatsappRecipients: _i(wa['recipients']),
      linkSentAt: DateTime.tryParse(_s(wa['sentAt'])),
      delivery: d is Map ? (queued: _i(d['queued']), sent: _i(d['sent']), failed: _i(d['failed'])) : null,
    );
  }
}

class VoteSetup {
  VoteSetup({required this.categories, required this.status});
  final List<VoteCategory> categories;
  final VotingStatus status;
  factory VoteSetup.fromJson(Json j) => VoteSetup(
        categories: _list(j['categories'], VoteCategory.fromJson),
        status: VotingStatus.fromJson(_m(j['status'])),
      );
}

// ───────────────────────── Planner ─────────────────────────

/// Slot keys in planner `assignees`, in card order, with labels.
const plannerSlots = <String, String>{
  'tmod': 'TMOD',
  'ttm': 'TTM',
  'ttEvaluator': 'TT Evaluator',
  'speaker1': 'Speaker 1',
  'evaluator1': 'Evaluator 1',
  'speaker2': 'Speaker 2',
  'evaluator2': 'Evaluator 2',
  'speaker3': 'Speaker 3',
  'evaluator3': 'Evaluator 3',
  'speaker4': 'Speaker 4',
  'evaluator4': 'Evaluator 4',
  'generalEvaluator': 'General Evaluator',
  'timer': 'Timer',
  'ahCounter': 'Ah-counter',
  'grammarian': 'Grammarian',
  'harkmaster': 'Harkmaster',
};

/// Lens filters: which slots each chip shows.
const plannerLenses = <String, List<String>>{
  'All roles': [],
  'TMOD': ['tmod'],
  'Table Topics': ['ttm', 'ttEvaluator'],
  'Speakers': ['speaker1', 'speaker2', 'speaker3', 'speaker4'],
  'Evaluators': ['evaluator1', 'evaluator2', 'evaluator3', 'evaluator4'],
  'Gen. Evaluator': ['generalEvaluator'],
  'Timer': ['timer'],
  'Ah-counter': ['ahCounter'],
  'Grammarian': ['grammarian'],
  'Harkmaster': ['harkmaster'],
};

class PlannerRow {
  PlannerRow({
    required this.id,
    this.meetingNumber,
    this.dateTime,
    this.theme = '',
    this.notes = '',
    this.assignees = const {},
    this.meetingId,
  });
  final String id;
  final int? meetingNumber;
  final DateTime? dateTime;
  final String theme;
  final String notes;
  final Map<String, dynamic> assignees; // slot → {kind, memberId} | {kind:'guest', name, guestId?} | null
  final String? meetingId;

  factory PlannerRow.fromJson(Json j) => PlannerRow(
        id: _s(j['id']),
        meetingNumber: j['meetingNumber'] == null ? null : _i(j['meetingNumber']),
        dateTime: _so(j['dateTime']) == null ? null : BdTime.parse(j['dateTime'] as String),
        theme: _s(j['theme']),
        notes: _s(j['notes']),
        assignees: j['assignees'] is Map ? Map<String, dynamic>.from(j['assignees'] as Map) : const {},
        meetingId: _so(j['meetingId']),
      );

  /// Plain-JSON assignee for an app [Assignee].
  static Map<String, dynamic>? assigneeJson(Assignee? a) {
    if (a == null) return null;
    return a.isGuest ? {'kind': 'guest', 'name': a.name, 'guestId': a.id} : {'kind': 'member', 'memberId': a.id};
  }
}

// ───────────────────────── Invites / club admin ─────────────────────────

/// Roles as the membership endpoints spell them (`OFFICER_ROLES` in the API).
const officerRoles = <String, String>{
  'Member': 'Member',
  'President': 'President',
  'VPE': 'VP Education',
  'VPM': 'VP Membership',
  'VPPR': 'VP Public Relations',
  'Secretary': 'Secretary',
  'Treasurer': 'Treasurer',
  'SAA': 'Sergeant at Arms',
  'Moderator': 'Moderator',
};

/// Session/club role → officer role spelling.
const clubToOfficer = <String, String>{
  'Member': 'Member',
  'President': 'President',
  'VPEducation': 'VPE',
  'VPMembership': 'VPM',
  'VPPR': 'VPPR',
  'Secretary': 'Secretary',
  'Treasurer': 'Treasurer',
  'SergeantAtArms': 'SAA',
  'Moderator': 'Moderator',
};

class Invite {
  Invite({
    required this.id,
    required this.roles,
    required this.status,
    required this.token,
    this.inviteeName,
    this.expiresAt,
    this.invitedAt,
  });
  final String id;
  final List<String> roles;
  final String status; // pending | accepted | revoked | expired
  final String token;
  final String? inviteeName;
  final String? expiresAt;
  final String? invitedAt;

  bool get isPending => status == 'pending';

  factory Invite.fromJson(Json j) => Invite(
        id: _s(j['id']),
        roles: j['roles'] is List ? (j['roles'] as List).map((e) => '$e').toList() : const [],
        status: _s(j['status']),
        token: _s(j['token']),
        inviteeName: _so(j['inviteeName']),
        expiresAt: _so(j['expiresAt']),
        invitedAt: _so(j['invitedAt']),
      );
}

// ───────────────────────── Org tree ─────────────────────────

/// One node of District → Division → Area → Club.
class OrgNode {
  OrgNode({required this.id, required this.name, this.parentId, this.code, this.clubNumber, this.status});
  final String id;
  final String name;
  final String? parentId;
  final String? code; // district code
  final String? clubNumber; // clubs
  final String? status; // clubs: active | low | suspended

  factory OrgNode.district(Json j) => OrgNode(id: _s(j['id']), name: _s(j['name']), code: _so(j['code']));
  factory OrgNode.division(Json j) => OrgNode(id: _s(j['id']), name: _s(j['name']), parentId: _so(j['districtId']));
  factory OrgNode.area(Json j) => OrgNode(id: _s(j['id']), name: _s(j['name']), parentId: _so(j['divisionId']));
  factory OrgNode.club(Json j) => OrgNode(
        id: _s(j['id']),
        name: _s(j['name']),
        parentId: _so(j['areaId']),
        clubNumber: _so(j['clubNumber']),
        status: _so(j['status']),
      );
}

enum OrgLevel {
  district('districts', 'District', null),
  division('divisions', 'Division', 'districtId'),
  area('areas', 'Area', 'divisionId'),
  club('org-clubs', 'Club', 'areaId');

  const OrgLevel(this.path, this.label, this.parentField);
  final String path;
  final String label;
  final String? parentField;

  OrgLevel? get child => switch (this) {
        OrgLevel.district => OrgLevel.division,
        OrgLevel.division => OrgLevel.area,
        OrgLevel.area => OrgLevel.club,
        OrgLevel.club => null,
      };

  OrgLevel? get parent => switch (this) {
        OrgLevel.district => null,
        OrgLevel.division => OrgLevel.district,
        OrgLevel.area => OrgLevel.division,
        OrgLevel.club => OrgLevel.area,
      };

  OrgNode parse(Json j) => switch (this) {
        OrgLevel.district => OrgNode.district(j),
        OrgLevel.division => OrgNode.division(j),
        OrgLevel.area => OrgNode.area(j),
        OrgLevel.club => OrgNode.club(j),
      };
}

// ───────────────────────── Platform users ─────────────────────────

class PlatformUser {
  PlatformUser({
    required this.id,
    required this.phone,
    required this.firstName,
    required this.lastName,
    required this.status,
    required this.isSuperAdmin,
    required this.membershipCount,
    required this.orgAssignmentCount,
    this.email,
    this.tiMemberNumber,
    this.createdAt,
  });
  final String id;
  final String phone;
  final String firstName;
  final String lastName;
  final String status; // active | suspended
  final bool isSuperAdmin;
  final int membershipCount;
  final int orgAssignmentCount;
  final String? email;
  final String? tiMemberNumber;
  final String? createdAt;

  String get name => fullName(firstName, lastName);

  factory PlatformUser.fromJson(Json j) => PlatformUser(
        id: _s(j['id']),
        phone: _s(j['phone']),
        firstName: _s(j['firstName']),
        lastName: _s(j['lastName']),
        status: _s(j['status']).isEmpty ? 'active' : _s(j['status']),
        isSuperAdmin: j['isSuperAdmin'] == true,
        membershipCount: _i(j['membershipCount']),
        orgAssignmentCount: _i(j['orgAssignmentCount']),
        email: _so(j['email']),
        tiMemberNumber: _so(j['tiMemberNumber']),
        createdAt: _so(j['createdAt']),
      );
}

class UsersPage {
  UsersPage(this.items, this.total, this.hasMore);
  final List<PlatformUser> items;
  final int total;
  final bool hasMore;
  factory UsersPage.fromJson(Json j) =>
      UsersPage(_list(j['items'], PlatformUser.fromJson), _i(j['total']), j['hasMore'] == true);
}

class OrgRoleAssignment {
  OrgRoleAssignment({required this.id, required this.role, required this.unitType, required this.unitId, required this.unitName});
  final String id;
  final String role;
  final String unitType;
  final String unitId;
  final String unitName;
  factory OrgRoleAssignment.fromJson(Json j) => OrgRoleAssignment(
        id: _s(j['id']),
        role: _s(j['role']),
        unitType: _s(j['unitType']),
        unitId: _s(j['unitId']),
        unitName: _s(j['unitName']),
      );
}

class WhatsappStatus {
  WhatsappStatus({required this.state, this.qr, this.number, this.name, this.error});
  final String state; // not-configured | worker-offline | disconnected | connecting | waiting-for-scan | connected
  final String? qr;
  final String? number;
  final String? name;
  final String? error;
  factory WhatsappStatus.fromJson(Json j) {
    final acc = j['account'] is Map ? j['account'] as Map : const {};
    return WhatsappStatus(
      state: _s(j['state']),
      qr: _so(j['qr']),
      number: _so(acc['number']),
      name: _so(acc['name']),
      error: _so(j['error']),
    );
  }
}
