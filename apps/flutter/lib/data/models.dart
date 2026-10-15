import '../core/access/access.dart';
import '../core/bd_time.dart';

typedef Json = Map<String, dynamic>;

String _s(Object? v) => v is String ? v : (v?.toString() ?? '');
String? _so(Object? v) => v is String && v.isNotEmpty ? v : null;
int _i(Object? v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
int? _io(Object? v) => v == null ? null : (v is num ? v.toInt() : int.tryParse('$v'));
List<T> _list<T>(Object? v, T Function(Json) f) =>
    v is List ? v.whereType<Map>().map((e) => f(Map<String, dynamic>.from(e))).toList() : <T>[];
List<String> _strs(Object? v) => v is List ? v.map((e) => '$e').toList() : const [];

// ───────────────────────────── Session ─────────────────────────────

class SessionUser {
  SessionUser({
    required this.id,
    required this.phone,
    required this.firstName,
    required this.lastName,
    this.email,
    this.avatarUrl,
    this.isSuperAdmin = false,
    this.mustChangePassword = false,
  });
  final String id;
  final String phone;
  final String firstName;
  final String lastName;
  final String? email;
  final String? avatarUrl;
  final bool isSuperAdmin;
  final bool mustChangePassword;

  String get name => fullName(firstName, lastName);

  factory SessionUser.fromJson(Json j) => SessionUser(
        id: _s(j['id']),
        phone: _s(j['phone']),
        firstName: _s(j['firstName']),
        lastName: _s(j['lastName']),
        email: _so(j['email']),
        avatarUrl: _so(j['avatarUrl']),
        isSuperAdmin: j['isSuperAdmin'] == true,
        mustChangePassword: j['mustChangePassword'] == true,
      );
}

class SessionMembership {
  SessionMembership({
    required this.clubId,
    required this.clubName,
    required this.membershipId,
    required this.roles,
    required this.overrides,
    required this.lineage,
  });
  final String clubId;
  final String clubName;
  final String membershipId;
  final List<String> roles;
  final Map<String, String> overrides;
  final Lineage lineage;

  factory SessionMembership.fromJson(Json j) => SessionMembership(
        clubId: _s(j['clubId']),
        clubName: _s(j['clubName']),
        membershipId: _s(j['membershipId']),
        roles: _strs(j['roles']),
        overrides: (j['overrides'] is Map)
            ? (j['overrides'] as Map).map((k, v) => MapEntry('$k', '$v'))
            : const {},
        lineage: Lineage.fromJson(j['lineage'] as Json?),
      );
}

class SessionOrgAssignment {
  SessionOrgAssignment({
    required this.unitType,
    required this.unitId,
    required this.unitName,
    required this.role,
    required this.lineage,
  });
  final String unitType;
  final String unitId;
  final String unitName;
  final String role;
  final Lineage lineage;

  factory SessionOrgAssignment.fromJson(Json j) => SessionOrgAssignment(
        unitType: _s(j['unitType']),
        unitId: _s(j['unitId']),
        unitName: _s(j['unitName']),
        role: _s(j['role']),
        lineage: Lineage.fromJson(j['lineage'] as Json?),
      );
}

class Session {
  Session({
    required this.user,
    required this.memberships,
    required this.orgAssignments,
    this.defaultContextKey,
  });
  final SessionUser user;
  final List<SessionMembership> memberships;
  final List<SessionOrgAssignment> orgAssignments;
  final String? defaultContextKey;

  factory Session.fromJson(Json j) => Session(
        user: SessionUser.fromJson(j['user'] as Json),
        memberships: _list(j['memberships'], SessionMembership.fromJson),
        orgAssignments: _list(j['orgAssignments'], SessionOrgAssignment.fromJson),
        defaultContextKey: _so(j['defaultContextKey']),
      );

  /// Every context this user can act in, in switcher order.
  List<AppContext> get contexts => [
        for (final m in memberships)
          AppContext(key: 'club:${m.clubId}', kind: ContextKind.club, label: m.clubName, clubId: m.clubId, membership: m),
        for (final o in orgAssignments)
          AppContext(
            key: '${o.unitType}:${o.unitId}',
            kind: ContextKind.org,
            label: o.unitName,
            unitType: o.unitType,
            lineage: o.lineage,
          ),
        if (user.isSuperAdmin) const AppContext(key: 'global', kind: ContextKind.global, label: 'Full access'),
      ];

  PermissionSubject subject(AppContext? ctx) => PermissionSubject(
        userId: user.id,
        assignments: [
          for (final m in memberships)
            ClubAssignment(
              clubId: m.clubId,
              membershipId: m.membershipId,
              roles: m.roles,
              overrides: m.overrides,
              lineage: m.lineage,
            ),
          for (final o in orgAssignments)
            OrgAssignment(unitType: o.unitType, unitId: o.unitId, role: o.role, lineage: o.lineage),
          if (user.isSuperAdmin) const GlobalAssignment(),
        ],
        contextLineage: ctx?.membership?.lineage ?? ctx?.lineage,
      );
}

enum ContextKind { club, org, global }

class AppContext {
  const AppContext({
    required this.key,
    required this.kind,
    required this.label,
    this.clubId,
    this.membership,
    this.unitType,
    this.lineage,
  });
  final String key;
  final ContextKind kind;
  final String label;
  final String? clubId;
  final SessionMembership? membership;
  final String? unitType;
  final Lineage? lineage;

  String get kindLabel => switch (kind) {
        ContextKind.club => 'Club',
        ContextKind.org => '${(unitType ?? '').isEmpty ? 'Org' : unitType![0].toUpperCase() + unitType!.substring(1)} director',
        ContextKind.global => 'Super admin',
      };
}

// ───────────────────────────── Meetings ─────────────────────────────

class WordOfTheDay {
  const WordOfTheDay({this.word = '', this.partOfSpeech = '', this.meaning = '', this.example = ''});
  final String word;
  final String partOfSpeech;
  final String meaning;
  final String example;

  bool get isEmpty => word.trim().isEmpty;

  factory WordOfTheDay.fromJson(Object? j) {
    if (j is! Map) return const WordOfTheDay();
    return WordOfTheDay(
      word: _s(j['word']),
      partOfSpeech: _s(j['partOfSpeech']),
      meaning: _s(j['meaning']),
      example: _s(j['example']),
    );
  }

  Json toJson() => {'word': word, 'partOfSpeech': partOfSpeech, 'meaning': meaning, 'example': example};
}

class Meeting {
  Meeting({
    required this.id,
    required this.clubId,
    required this.meetingNumber,
    required this.dateTime,
    required this.theme,
    required this.status,
    required this.shareToken,
    required this.word,
    this.speechCount,
  });
  final String id;
  final String clubId;
  final int meetingNumber;
  final DateTime dateTime;
  final String theme;
  final String status; // draft | published
  final String shareToken;
  final WordOfTheDay word;
  final int? speechCount;

  bool get isPublished => status == 'published';
  bool isPast(DateTime now) => !now.isBefore(dateTime.add(BdTime.meetingPastAfter));
  bool isLive(DateTime now) => !now.isBefore(dateTime) && !isPast(now);
  String get displayTheme => theme.trim().isEmpty ? 'Meeting #$meetingNumber' : theme;

  factory Meeting.fromJson(Json j) => Meeting(
        id: _s(j['id']),
        clubId: _s(j['clubId']),
        meetingNumber: _i(j['meetingNumber']),
        dateTime: BdTime.parse(_s(j['dateTime'])),
        theme: _s(j['theme']),
        status: _s(j['status']).isEmpty ? 'draft' : _s(j['status']),
        shareToken: _s(j['shareToken']),
        word: WordOfTheDay.fromJson(j['word']),
        speechCount: _io(j['speechCount']),
      );
}

class MeetingPartition {
  MeetingPartition(this.past, this.upcoming);
  final List<Meeting> past; // latest first
  final List<Meeting> upcoming; // soonest first
  Meeting? get current => upcoming.isEmpty ? null : upcoming.first;

  factory MeetingPartition.of(List<Meeting> all, DateTime now) {
    final sorted = [...all]..sort((a, b) => a.dateTime.compareTo(b.dateTime));
    final past = <Meeting>[];
    final upcoming = <Meeting>[];
    for (final m in sorted) {
      (m.isPast(now) ? past : upcoming).add(m);
    }
    return MeetingPartition(past.reversed.toList(), upcoming);
  }
}

class RoleAssignment {
  RoleAssignment({required this.roleKey, this.membershipId, this.guestId});
  final String roleKey;
  final String? membershipId;
  final String? guestId;
  bool get filled => membershipId != null || guestId != null;

  factory RoleAssignment.fromJson(Json j) => RoleAssignment(
        roleKey: _s(j['roleKey']),
        membershipId: _so(j['membershipId']),
        guestId: _so(j['guestId']),
      );
}

class PreparedSpeaker {
  PreparedSpeaker({
    required this.id,
    required this.order,
    required this.kind,
    required this.status,
    this.membershipId,
    this.guestId,
    this.evaluatorMembershipId,
    this.evaluatorGuestId,
    this.title = '',
    this.duration,
    this.pathway,
    this.project,
    this.notes,
    this.evaluationCount = 0,
  });
  final String id;
  final int order;
  final String kind; // prepared | keynote
  final String status; // requested | confirmed | delivered
  final String? membershipId;
  final String? guestId;
  final String? evaluatorMembershipId;
  final String? evaluatorGuestId;
  final String title;
  final int? duration;
  final String? pathway;
  final String? project;
  final String? notes;
  final int evaluationCount;

  bool get isKeynote => kind == 'keynote';
  bool get hasSpeaker => membershipId != null || guestId != null;

  factory PreparedSpeaker.fromJson(Json j) => PreparedSpeaker(
        id: _s(j['id']),
        order: _i(j['order']),
        kind: _s(j['kind']).isEmpty ? 'prepared' : _s(j['kind']),
        status: _s(j['status']).isEmpty ? 'requested' : _s(j['status']),
        membershipId: _so(j['membershipId']),
        guestId: _so(j['guestId']),
        evaluatorMembershipId: _so(j['evaluatorMembershipId']),
        evaluatorGuestId: _so(j['evaluatorGuestId']),
        title: _s(j['title']),
        duration: _io(j['duration']),
        pathway: _so(j['pathway']),
        project: _so(j['project']),
        notes: _so(j['notes']),
        evaluationCount: _i(j['evaluationCount']),
      );
}

class TableTopic {
  TableTopic({required this.id, required this.text, required this.asked});
  final String id;
  final String text;
  final bool asked;
  factory TableTopic.fromJson(Json j) =>
      TableTopic(id: _s(j['id']), text: _s(j['text']), asked: j['asked'] == true);
}

class PublicAgenda {
  PublicAgenda({
    required this.id,
    required this.meetingNumber,
    required this.dateTime,
    required this.theme,
    required this.clubName,
    required this.roles,
    required this.speakers,
    required this.word,
    this.clubContactPhone,
    this.clubVenueMapUrl,
  });
  final String id;
  final int meetingNumber;
  final DateTime dateTime;
  final String theme;
  final String clubName;
  final String? clubContactPhone;
  final String? clubVenueMapUrl;
  final List<({String roleKey, String name})> roles;
  final List<AgendaSpeaker> speakers;
  final WordOfTheDay word;

  factory PublicAgenda.fromJson(Json j) => PublicAgenda(
        id: _s(j['id']),
        meetingNumber: _i(j['meetingNumber']),
        dateTime: BdTime.parse(_s(j['dateTime'])),
        theme: _s(j['theme']),
        clubName: _s(j['clubName']),
        clubContactPhone: _so(j['clubContactPhone']),
        clubVenueMapUrl: _so(j['clubVenueMapUrl']),
        roles: [
          for (final r in (j['roles'] as List? ?? const []))
            if (r is Map) (roleKey: _s(r['roleKey']), name: _s(r['name'])),
        ],
        speakers: _list(j['speakers'], AgendaSpeaker.fromJson),
        word: WordOfTheDay.fromJson(j['word']),
      );
}

class AgendaSpeaker {
  AgendaSpeaker({
    required this.order,
    required this.kind,
    required this.title,
    required this.speakerName,
    required this.evaluatorName,
    this.duration,
    this.pathway,
    this.project,
  });
  final int order;
  final String kind;
  final String title;
  final String speakerName;
  final String evaluatorName;
  final int? duration;
  final String? pathway;
  final String? project;

  factory AgendaSpeaker.fromJson(Json j) => AgendaSpeaker(
        order: _i(j['order']),
        kind: _s(j['kind']),
        title: _s(j['title']),
        speakerName: _s(j['speakerName']),
        evaluatorName: _s(j['evaluatorName']),
        duration: _io(j['duration']),
        pathway: _so(j['pathway']),
        project: _so(j['project']),
      );
}

// ───────────────────────────── Club / members ─────────────────────────────

class Club {
  Club({
    required this.id,
    required this.name,
    this.venueAddress,
    this.venueMapUrl,
    this.contactPhone,
    this.bannerColor,
    this.bannerImageUrl,
    this.bannerImagePos,
    this.areaName,
    this.divisionName,
    this.districtName,
    this.motto,
  });
  final String id;
  final String name;
  final String? venueAddress;
  final String? venueMapUrl;
  final String? contactPhone;
  final String? bannerColor;
  final String? bannerImageUrl;

  /// Where the banner image sits in the printed agenda's strip — `x`/`y` as
  /// CSS background-position percentages, `zoom` ≥ 1, and the image's
  /// width/height `aspect` when known (see web `lib/club/banner.ts`).
  final ({double x, double y, double zoom, double? aspect})? bannerImagePos;
  final String? areaName;
  final String? divisionName;
  final String? districtName;
  final String? motto;

  factory Club.fromJson(Json j) => Club(
        id: _s(j['id']),
        name: _s(j['name']),
        venueAddress: _so(j['venueAddress']),
        venueMapUrl: _so(j['venueMapUrl']),
        contactPhone: _so(j['contactPhone']),
        bannerColor: _so(j['bannerColor']),
        bannerImageUrl: _so(j['bannerImageUrl']),
        bannerImagePos: switch (j['bannerImagePos']) {
          final Map p => (
              x: (p['x'] as num?)?.toDouble() ?? 50,
              y: (p['y'] as num?)?.toDouble() ?? 50,
              zoom: (p['zoom'] as num?)?.toDouble() ?? 1,
              aspect: (p['aspect'] as num?)?.toDouble(),
            ),
          _ => null,
        },
        areaName: _so(j['areaName']),
        divisionName: _so(j['divisionName']),
        districtName: _so(j['districtName']),
        motto: _so(j['motto']),
      );
}

class Member {
  Member({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.roles,
    required this.isClubAdmin,
    required this.status,
    this.userId,
    this.email,
    this.phone,
    this.avatarUrl,
    this.bio,
    this.pathway,
    this.level,
    this.startedProject,
    this.pathwayStartedAt,
    this.overrides = const {},
    this.clubId,
  });
  final String id; // membershipId
  final String? clubId;
  final String firstName;
  final String lastName;
  final List<String> roles;
  final bool isClubAdmin;
  final String status;
  final String? userId;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String? bio;
  final String? pathway;
  final int? level;
  final String? startedProject;
  final String? pathwayStartedAt;

  /// Per-member permission overrides, `"resource:action": "allow" | "deny"`.
  final Map<String, String> overrides;

  String get name => fullName(firstName, lastName);
  bool get isActive => status == 'active';

  /// "Member, Treasurer"
  String get rolesLabel => roles.map(roleLabel).join(', ');

  factory Member.fromJson(Json j) => Member(
        id: _s(j['id']),
        firstName: _s(j['firstName']),
        lastName: _s(j['lastName']),
        roles: _strs(j['roles']),
        isClubAdmin: j['isClubAdmin'] == true,
        status: _s(j['status']).isEmpty ? 'active' : _s(j['status']),
        userId: _so(j['userId']),
        email: _so(j['email']),
        phone: _so(j['phone']),
        avatarUrl: _so(j['avatarUrl']),
        bio: _so(j['bio']),
        pathway: _so(j['pathway']),
        level: _io(j['level']),
        startedProject: _so(j['startedProject']),
        pathwayStartedAt: _so(j['pathwayStartedAt']),
        overrides: j['overrides'] is Map ? (j['overrides'] as Map).map((k, v) => MapEntry('$k', '$v')) : const {},
        clubId: _so(j['clubId']),
      );
}

class MemberStats {
  MemberStats({
    required this.speechesGiven,
    required this.projectsCompleted,
    required this.meetingsAttended,
    required this.rolesTaken,
    this.joinedAt,
    this.currentProject,
    this.latestSpeech,
  });
  final int speechesGiven;
  final int projectsCompleted;
  final int meetingsAttended;
  final int rolesTaken;
  final String? joinedAt;
  final ({String name, int level, String pathway, String startedDate})? currentProject;
  final ({String title, String date, int meetingNumber})? latestSpeech;

  factory MemberStats.fromJson(Json j) {
    final cp = j['currentProject'];
    final ls = j['latestSpeech'];
    return MemberStats(
      speechesGiven: _i(j['speechesGiven']),
      projectsCompleted: _i(j['projectsCompleted']),
      meetingsAttended: _i(j['meetingsAttended']),
      rolesTaken: _i(j['rolesTaken']),
      joinedAt: _so(j['joinedAt']),
      currentProject: cp is Map
          ? (name: _s(cp['name']), level: _i(cp['level']), pathway: _s(cp['pathway']), startedDate: _s(cp['startedDate']))
          : null,
      latestSpeech: ls is Map
          ? (title: _s(ls['title']), date: _s(ls['date']), meetingNumber: _i(ls['meetingNumber']))
          : null,
    );
  }
}

class HistoryEvent {
  HistoryEvent({
    required this.id,
    required this.date,
    required this.type,
    this.title,
    this.meetingNumber,
    this.projectName,
    this.meetingSpeakerId,
    this.level,
    this.roleName,
    this.pathway,
  });
  final String id;
  final String date; // YYYY-MM-DD (Bangladesh calendar date)
  final String type; // joined | level-reached | speech-given | project-started | project-completed | role-taken
  final String? title;
  final int? meetingNumber;
  final String? projectName;
  final String? meetingSpeakerId;
  final int? level;
  final String? roleName;
  final String? pathway;

  factory HistoryEvent.fromJson(Json j) => HistoryEvent(
        id: _s(j['id']),
        date: _s(j['date']),
        type: _s(j['type']),
        title: _so(j['title']),
        meetingNumber: _io(j['meetingNumber']),
        projectName: _so(j['projectName']),
        meetingSpeakerId: _so(j['meetingSpeakerId']),
        level: _io(j['level']),
        roleName: _so(j['role']),
        pathway: _so(j['pathway']),
      );
}

class ReceivedEvaluation {
  ReceivedEvaluation({
    required this.id,
    required this.meetingSpeakerId,
    required this.meetingNumber,
    required this.speechTitle,
    required this.evaluatorName,
    required this.isAssignedEvaluator,
    required this.submittedAt,
    required this.imageUrls,
    this.audioUrl,
    this.text,
  });
  final String id;
  final String meetingSpeakerId;
  final int meetingNumber;
  final String speechTitle;
  final String evaluatorName;
  final bool isAssignedEvaluator;
  final String submittedAt;
  final List<String> imageUrls;
  final String? audioUrl;
  final String? text;

  factory ReceivedEvaluation.fromJson(Json j) => ReceivedEvaluation(
        id: _s(j['id']),
        meetingSpeakerId: _s(j['meetingSpeakerId']),
        meetingNumber: _i(j['meetingNumber']),
        speechTitle: _s(j['speechTitle']),
        evaluatorName: _s(j['evaluatorName']),
        isAssignedEvaluator: j['isAssignedEvaluator'] == true,
        submittedAt: _s(j['submittedAt']),
        imageUrls: _strs(j['imageUrls']),
        audioUrl: _so(j['audioUrl']),
        text: _so(j['text']),
      );
}

class TimerReport {
  TimerReport({
    required this.speechEventId,
    required this.targetMinMinutes,
    required this.targetMaxMinutes,
    required this.actualSeconds,
  });
  final String speechEventId;
  final num targetMinMinutes;
  final num targetMaxMinutes;
  final int actualSeconds;

  String get verdict {
    final m = actualSeconds / 60;
    if (m < targetMinMinutes) return 'Under time';
    if (m > targetMaxMinutes) return 'Over time';
    return 'Within time';
  }

  factory TimerReport.fromJson(Json j) => TimerReport(
        speechEventId: _s(j['speechEventId']),
        targetMinMinutes: (j['targetMinMinutes'] as num?) ?? 0,
        targetMaxMinutes: (j['targetMaxMinutes'] as num?) ?? 0,
        actualSeconds: _i(j['actualSeconds']),
      );
}

class AhReport {
  AhReport({required this.speechEventId, required this.fillerCounts});
  final String speechEventId;
  final Map<String, int> fillerCounts;
  int get total => fillerCounts.values.fold(0, (a, b) => a + b);

  factory AhReport.fromJson(Json j) => AhReport(
        speechEventId: _s(j['speechEventId']),
        fillerCounts: (j['fillerCounts'] is Map)
            ? (j['fillerCounts'] as Map).map((k, v) => MapEntry('$k', _i(v)))
            : const {},
      );
}

class SpeechSlotRequest {
  SpeechSlotRequest({
    required this.id,
    required this.meetingId,
    required this.status,
    this.projectName,
    this.note,
    this.requestedAt,
  });
  final String id;
  final String meetingId;
  final String status; // pending | approved | declined
  final String? projectName;
  final String? note;
  final String? requestedAt;

  static const noteMax = 240;
  static const projectMax = 120;

  String get statusLabel => switch (status) {
        'approved' => 'Approved',
        'declined' => 'Declined',
        _ => 'Pending',
      };

  factory SpeechSlotRequest.fromJson(Json j) => SpeechSlotRequest(
        id: _s(j['id']),
        meetingId: _s(j['meetingId']),
        status: _s(j['status']).isEmpty ? 'pending' : _s(j['status']),
        projectName: _so(j['projectName']),
        note: _so(j['note']),
        requestedAt: _so(j['requestedAt']),
      );
}

class Social {
  const Social({required this.platform, required this.url});
  final String platform;
  final String url;
  factory Social.fromJson(Json j) => Social(platform: _s(j['platform']), url: _s(j['url']));
  Json toJson() => {'platform': platform, 'url': url};
}

const socialPlatforms = <String, String>{
  'linkedin': 'LinkedIn',
  'facebook': 'Facebook',
  'instagram': 'Instagram',
  'youtube': 'YouTube',
  'twitter': 'X (Twitter)',
  'tiktok': 'TikTok',
  'website': 'Website',
  'other': 'Other',
};

class Profile {
  Profile({
    required this.id,
    required this.phone,
    required this.firstName,
    required this.lastName,
    this.email,
    this.bio,
    this.avatarUrl,
    this.socials = const [],
    this.createdAt,
    this.memberships = const [],
  });
  final String id;
  final String phone;
  final String firstName;
  final String lastName;
  final String? email;
  final String? bio;
  final String? avatarUrl;
  final List<Social> socials;
  final String? createdAt;
  final List<({String clubId, String clubName, String? pathway, int? level})> memberships;

  String get name => fullName(firstName, lastName);

  factory Profile.fromJson(Json j) => Profile(
        id: _s(j['id']),
        phone: _s(j['phone']),
        firstName: _s(j['firstName']),
        lastName: _s(j['lastName']),
        email: _so(j['email']),
        bio: _so(j['bio']),
        avatarUrl: _so(j['avatarUrl']),
        socials: _list(j['socials'], Social.fromJson),
        createdAt: _so(j['createdAt']),
        memberships: [
          for (final m in (j['memberships'] as List? ?? const []))
            if (m is Map)
              (
                clubId: _s(m['clubId']),
                clubName: _s(m['clubName']),
                pathway: _so(m['pathway']),
                level: _io(m['level']),
              ),
        ],
      );
}

// ───────────────────────────── Guests ─────────────────────────────

class Guest {
  Guest({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.stage,
    required this.visitCount,
    this.firstVisit,
    this.lastVisit,
    this.sharedContact = false,
    this.phone,
    this.whatsapp,
    this.email,
    this.notes,
    this.invitedBy,
    this.organization,
    this.bio,
    this.avatarUrl,
    this.socials = const [],
  });
  final String id;
  final String firstName;
  final String lastName;
  final String stage;
  final int visitCount;
  final String? firstVisit;
  final String? lastVisit;
  final bool sharedContact;
  final String? phone;
  final String? whatsapp;
  final String? email;
  final String? notes;
  final String? invitedBy;
  final String? organization;
  final String? bio;
  final String? avatarUrl;
  final List<Social> socials;

  String get name {
    final n = fullName(firstName, lastName);
    return n.isEmpty ? 'Unnamed guest' : n;
  }

  /// "2 visits · 2 Oct" or "No visits yet"
  String get visitsLabel {
    if (visitCount <= 0) return 'No visits yet';
    final last = lastVisit == null || lastVisit!.isEmpty ? '' : ' · ${_shortDay(lastVisit!)}';
    return '$visitCount visit${visitCount == 1 ? '' : 's'}$last';
  }

  static String _shortDay(String ymd) {
    final d = DateTime.tryParse(ymd);
    if (d == null) return ymd;
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${m[d.month - 1]}';
  }

  factory Guest.fromJson(Json j) => Guest(
        id: _s(j['id']),
        firstName: _s(j['firstName']),
        lastName: _s(j['lastName']),
        stage: _s(j['stage']).isEmpty ? 'new' : _s(j['stage']),
        visitCount: _i(j['visitCount']),
        firstVisit: _so(j['firstVisit']),
        lastVisit: _so(j['lastVisit']),
        sharedContact: j['sharedContact'] == true,
        phone: _so(j['phone']),
        whatsapp: _so(j['whatsapp']),
        email: _so(j['email']),
        notes: _so(j['notes']),
        invitedBy: _so(j['invitedBy']),
        organization: _so(j['organization']),
        bio: _so(j['bio']),
        avatarUrl: _so(j['avatarUrl']),
        socials: _list(j['socials'], Social.fromJson),
      );
}

class VisitLog {
  VisitLog({
    required this.id,
    required this.meetingId,
    required this.origin,
    this.role,
    this.notes,
    this.createdAt,
    this.updatedAt,
  });
  final String id;
  final String meetingId;
  final String origin; // auto | manual
  final String? role;
  final String? notes;
  final String? createdAt;
  final String? updatedAt;

  static const roleMax = 80;
  static const notesMax = 2000;

  bool get isAuto => origin == 'auto';
  bool get edited => updatedAt != null;

  factory VisitLog.fromJson(Json j) => VisitLog(
        id: _s(j['id']),
        meetingId: _s(j['meetingId']),
        origin: _s(j['origin']).isEmpty ? 'manual' : _s(j['origin']),
        role: _so(j['role']),
        notes: _so(j['notes']),
        createdAt: _so(j['createdAt']),
        updatedAt: _so(j['updatedAt']),
      );
}

const contactMethods = <String, String>{
  'call': 'Call',
  'message': 'Message',
  'email': 'Email',
  'in-person': 'In person',
  'other': 'Other',
};

class ContactLog {
  ContactLog({required this.id, required this.method, required this.outcome, this.createdAt, this.updatedAt});
  final String id;
  final String method;
  final String outcome;
  final String? createdAt;
  final String? updatedAt;

  static const outcomeMax = 2000;

  factory ContactLog.fromJson(Json j) => ContactLog(
        id: _s(j['id']),
        method: _s(j['method']),
        outcome: _s(j['outcome']),
        createdAt: _so(j['createdAt']),
        updatedAt: _so(j['updatedAt']),
      );
}

class PersonLookup {
  PersonLookup({
    required this.found,
    required this.claimed,
    this.firstName,
    this.lastName,
    this.email,
    this.whatsapp,
    this.organization,
    required this.memberOfYourClub,
    required this.guestInYourClubId,
  });
  final bool found;
  final bool claimed;
  final String? firstName;
  final String? lastName;
  final String? email;
  final String? whatsapp;
  final String? organization;
  final bool memberOfYourClub;
  final String? guestInYourClubId;

  factory PersonLookup.fromJson(Json j) {
    final yc = j['yourClub'] is Map ? j['yourClub'] as Map : const {};
    return PersonLookup(
      found: j['status'] == 'found',
      claimed: j['claimed'] == true,
      firstName: _so(j['firstName']),
      lastName: _so(j['lastName']),
      email: _so(j['email']),
      whatsapp: _so(j['whatsapp']),
      organization: _so(j['organization']),
      memberOfYourClub: yc['isMember'] == true,
      guestInYourClubId: yc['isGuest'] == true ? _so(yc['guestId']) : null,
    );
  }
}

class DirectoryClub {
  DirectoryClub({
    required this.id,
    required this.name,
    this.clubNumber,
    this.areaName,
    this.divisionName,
    this.districtName,
  });
  final String id;
  final String name;
  final String? clubNumber;
  final String? areaName;
  final String? divisionName;
  final String? districtName;

  factory DirectoryClub.fromJson(Json j) => DirectoryClub(
        id: _s(j['id']),
        name: _s(j['name']),
        clubNumber: _so(j['clubNumber']),
        areaName: _so(j['areaName']),
        divisionName: _so(j['divisionName']),
        districtName: _so(j['districtName']),
      );
}

/// Who fills a slot — a club member or a pipeline guest.
class Assignee {
  const Assignee.member(this.id, this.name) : isGuest = false;
  const Assignee.guest(this.id, this.name) : isGuest = true;
  final String id;
  final String name;
  final bool isGuest;
}
