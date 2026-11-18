import '../core/api/api_client.dart';
import 'models.dart';

List<T> _list<T>(dynamic data, T Function(Json) f) =>
    data is List ? data.whereType<Map>().map((e) => f(Map<String, dynamic>.from(e))).toList() : <T>[];
Json _map(dynamic data) => data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};

/// Typed wrapper over every endpoint the app uses. Paths are relative to
/// `{API_URL}/api` and match `apps/web/src/store/api.ts`.
class ToastieApi {
  ToastieApi(this.http);
  final ApiClient http;

  // ── Auth ──
  /// Sign in with exactly one of [email] or [phone].
  Future<Json> login({String? email, String? phone, required String password}) async =>
      _map(await http.post('auth/login', body: {
        'email': ?email,
        'phone': ?phone,
        'password': password,
      }, anonymous: true));

  /// Final sign-up step; [signupToken] comes from [verifySignupCode].
  Future<Json> register({
    required String signupToken,
    required String name,
    required String phone,
    required String password,
  }) async =>
      _map(await http.post('auth/register', body: {
        'signupToken': signupToken,
        'name': name,
        'phone': phone,
        'password': password,
      }, anonymous: true));

  Future<void> sendSignupCode(String email) =>
      http.post('auth/signup/email/send-code', body: {'email': email}, anonymous: true);

  Future<String> verifySignupCode(String email, String code) async =>
      _map(await http.post('auth/signup/email/verify', body: {'email': email, 'code': code}, anonymous: true))[
          'signupToken'] as String;

  Future<void> forgotPassword(String email) =>
      http.post('auth/password/forgot', body: {'email': email}, anonymous: true);

  Future<void> resetPassword({required String email, required String code, required String newPassword}) =>
      http.post('auth/password/reset',
          body: {'email': email, 'code': code, 'newPassword': newPassword}, anonymous: true);

  Future<void> requestWhatsappCode(String phone) =>
      http.post('auth/recovery/whatsapp/request', body: {'phone': phone}, anonymous: true);

  /// Signs in on success — same response as [login].
  Future<Json> resetWithWhatsapp({required String phone, required String code, required String newPassword}) async =>
      _map(await http.post('auth/recovery/whatsapp/reset',
          body: {'phone': phone, 'code': code, 'newPassword': newPassword}, anonymous: true));

  /// Signed in: email a code to [email] to make it the sign-in email.
  Future<void> sendEmailCode(String email) => http.post('auth/email/send-code', body: {'email': email});

  /// Returns the fresh session (`mustVerifyEmail: false`).
  Future<Json> verifyEmail(String email, String code) async =>
      _map(await http.post('auth/email/verify', body: {'email': email, 'code': code}));

  Future<Json> sessionRaw() async => _map(await http.get('auth/session', cache: false));

  Future<void> logout() async {
    try {
      await http.post('auth/logout', body: {'refreshToken': http.tokens.refreshToken});
    } catch (_) {}
  }

  Future<void> changePassword(String current, String next) =>
      http.patch('auth/password', body: {'currentPassword': current, 'newPassword': next});

  // ── Clubs / onboarding ──
  Future<Club> myClub() async => Club.fromJson(_map(await http.get('clubs/mine')));
  Future<List<DirectoryClub>> clubDirectory() async =>
      _list(await http.get('clubs/directory'), DirectoryClub.fromJson);
  Future<Json> joinByCode(String code) async => _map(await http.post('clubs/join-by-code', body: {'code': code}));
  Future<Json> invitePreview(String token) async =>
      _map(await http.get('public/invites/$token', anonymous: true, cache: false));
  Future<Json> acceptInvite(String token) async => _map(await http.post('invites/$token/accept'));

  // ── Meetings ──
  Future<List<Meeting>> meetings() async => _list(await http.get('meetings'), Meeting.fromJson);
  Future<Meeting> meeting(String id) async => Meeting.fromJson(_map(await http.get('meetings/$id')));
  Future<Meeting> createMeeting({required int number, required DateTime dateTime, required String theme}) async =>
      Meeting.fromJson(_map(await http.post('meetings', body: {
        'meetingNumber': number,
        'dateTime': dateTime.toUtc().toIso8601String(),
        'theme': theme,
      })));
  Future<Meeting> updateMeeting(String id, Json patch) async =>
      Meeting.fromJson(_map(await http.patch('meetings/$id', body: patch)));
  Future<void> deleteMeeting(String id) => http.delete('meetings/$id');

  Future<List<RoleAssignment>> meetingRoles(String id) async =>
      _list(await http.get('meetings/$id/roles'), RoleAssignment.fromJson);
  Future<void> setMeetingRole(String meetingId, String roleKey, Assignee? who) =>
      http.put('meetings/$meetingId/roles/$roleKey', body: {
        'membershipId': who != null && !who.isGuest ? who.id : null,
        'guestId': who != null && who.isGuest ? who.id : null,
      });

  Future<List<PreparedSpeaker>> speakers(String meetingId) async =>
      _list(await http.get('meetings/$meetingId/prepared-speakers'), PreparedSpeaker.fromJson);
  Future<PreparedSpeaker> createSpeaker(String meetingId, {String kind = 'prepared'}) async =>
      PreparedSpeaker.fromJson(_map(await http.post('meetings/$meetingId/prepared-speakers', body: {'kind': kind})));
  Future<PreparedSpeaker> updateSpeaker(String meetingId, String id, Json patch) async =>
      PreparedSpeaker.fromJson(_map(await http.patch('meetings/$meetingId/prepared-speakers/$id', body: patch)));
  Future<void> deleteSpeaker(String meetingId, String id) =>
      http.delete('meetings/$meetingId/prepared-speakers/$id');
  Future<void> reorderSpeakers(String meetingId, List<String> ids) =>
      http.post('meetings/$meetingId/prepared-speakers/reorder', body: {'speakerIds': ids});

  Future<List<TableTopic>> tableTopics(String meetingId) async =>
      _list(await http.get('meetings/$meetingId/table-topics'), TableTopic.fromJson);

  Future<PublicAgenda> publicAgenda(String meetingId) async =>
      PublicAgenda.fromJson(_map(await http.get('public/meetings/$meetingId/agenda', anonymous: true)));

  /// Live-tool state blob (`timer` | `ah-counter` | `grammarian`).
  Future<({Json? state, String? updatedAt})> roleState(String meetingId, String kind, {String? token}) async {
    final path = token == null
        ? 'meetings/$meetingId/role-state/$kind'
        : 'public/meetings/$meetingId/role-state/$kind';
    final data = _map(await http.get(path, query: token == null ? null : {'t': token}, anonymous: token != null, cache: false));
    final s = data['state'];
    return (state: s is Map ? Map<String, dynamic>.from(s) : null, updatedAt: data['updatedAt'] as String?);
  }

  Future<void> saveRoleState(String meetingId, String kind, Json state, {String? token}) {
    if (token == null) return http.put('meetings/$meetingId/role-state/$kind', body: {'state': state});
    return http.put('public/meetings/$meetingId/role-state/$kind?t=${Uri.encodeQueryComponent(token)}',
        body: {'state': state});
  }

  // ── Members / education ──
  Future<List<Member>> members() async => _list(await http.get('members'), Member.fromJson);
  Future<Member> member(String id) async => Member.fromJson(_map(await http.get('members/$id')));
  Future<MemberStats> memberStats(String id) async => MemberStats.fromJson(_map(await http.get('members/$id/stats')));
  Future<List<HistoryEvent>> memberHistory(String id) async =>
      _list(await http.get('members/$id/history'), HistoryEvent.fromJson);
  Future<List<ReceivedEvaluation>> receivedEvaluations(String id) async =>
      _list(await http.get('members/$id/received-evaluations'), ReceivedEvaluation.fromJson);
  Future<List<TimerReport>> timerEntries(String id) async =>
      _list(await http.get('members/$id/timer-entries'), TimerReport.fromJson);
  Future<List<AhReport>> ahEntries(String id) async =>
      _list(await http.get('members/$id/ah-counter-entries'), AhReport.fromJson);
  Future<List<SpeechSlotRequest>> speechSlotRequests(String id) async =>
      _list(await http.get('members/$id/speech-slot-requests'), SpeechSlotRequest.fromJson);
  Future<void> requestSpeechSlot(String memberId, {required String meetingId, String? project, String? note}) =>
      http.post('members/$memberId/speech-slot-requests', body: {
        'meetingId': meetingId,
        if (project != null && project.isNotEmpty) 'projectName': project,
        if (note != null && note.isNotEmpty) 'note': note,
      });

  // ── Profile ──
  Future<Profile> profile() async => Profile.fromJson(_map(await http.get('profile')));
  Future<Profile> updateProfile(Json patch) async => Profile.fromJson(_map(await http.patch('profile', body: patch)));
  Future<void> deleteAccount(String currentPassword) =>
      http.delete('profile', body: {'currentPassword': currentPassword});

  // ── Guests ──
  Future<List<Guest>> guests() async => _list(await http.get('guests'), Guest.fromJson);
  Future<Guest> guest(String id) async => Guest.fromJson(_map(await http.get('guests/$id')));
  Future<Guest> createGuest(Json body) async => Guest.fromJson(_map(await http.post('guests', body: body)));
  Future<Guest> updateGuest(String id, Json patch) async =>
      Guest.fromJson(_map(await http.patch('guests/$id', body: patch)));
  Future<void> deleteGuest(String id) => http.delete('guests/$id');
  Future<PersonLookup> lookupPhone(String phone) async =>
      PersonLookup.fromJson(_map(await http.get('guests/lookup', query: {'phone': phone}, cache: false)));
  /// The club's guest sign-up token; the shareable URL is
  /// `{web}/guest-invite/{token}`.
  Future<String?> guestInviteToken() async => _map(await http.get('guests/invite-link', cache: false))['token'] as String?;

  Future<String?> rotateGuestInviteToken() async =>
      _map(await http.post('guests/invite-link/rotate'))['token'] as String?;

  Future<List<VisitLog>> visitLogs(String guestId) async =>
      _list(await http.get('guests/$guestId/visit-logs'), VisitLog.fromJson);
  Future<void> createVisitLog(String guestId, Json body) => http.post('guests/$guestId/visit-logs', body: body);
  Future<void> updateVisitLog(String guestId, String id, Json body) =>
      http.patch('guests/$guestId/visit-logs/$id', body: body);
  Future<void> deleteVisitLog(String guestId, String id) => http.delete('guests/$guestId/visit-logs/$id');

  Future<List<ContactLog>> contactLogs(String guestId) async =>
      _list(await http.get('guests/$guestId/contact-logs'), ContactLog.fromJson);
  Future<void> createContactLog(String guestId, Json body) => http.post('guests/$guestId/contact-logs', body: body);
  Future<void> updateContactLog(String guestId, String id, Json body) =>
      http.patch('guests/$guestId/contact-logs/$id', body: body);
  Future<void> deleteContactLog(String guestId, String id) => http.delete('guests/$guestId/contact-logs/$id');

  // ── Notifications ──
  // Account-wide, not per club — never served from the per-context cache.
  Future<NotificationPage> notifications({String? cursor, bool unreadOnly = false, int limit = 20}) async =>
      NotificationPage.fromJson(_map(await http.get('notifications', cache: false, query: {
        'limit': limit,
        'cursor': ?cursor,
        if (unreadOnly) 'unread': true,
      })));
  Future<int> unreadNotificationCount() async {
    final count = _map(await http.get('notifications/unread-count', cache: false))['count'];
    return count is num ? count.toInt() : 0;
  }

  Future<void> markNotificationRead(String id) => http.post('notifications/$id/read');
  Future<void> markAllNotificationsRead() => http.post('notifications/read-all');
}
