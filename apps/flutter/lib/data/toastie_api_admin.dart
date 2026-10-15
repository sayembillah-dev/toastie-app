import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'models.dart';
import 'models_admin.dart';
import 'toastie_api.dart';

List<T> _list<T>(dynamic data, T Function(Json) f) =>
    data is List ? data.whereType<Map>().map((e) => f(Map<String, dynamic>.from(e))).toList() : <T>[];
Json _map(dynamic data) => data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};

/// Endpoints for attendance, voting, planner, club admin, the org tree,
/// platform users, WhatsApp and uploads. Mirrors `apps/web/src/store/api.ts`.
extension ToastieAdminApi on ToastieApi {
  // ── Attendance ──
  Future<Map<String, bool>> attendanceMembers(String meetingId) async {
    final rows = await http.get('meetings/$meetingId/attendance/members', cache: false);
    return {
      for (final r in (rows as List? ?? const []))
        if (r is Map) '${r['membershipId']}': r['present'] == true,
    };
  }

  Future<void> setMemberAttendance(String meetingId, String membershipId, bool present) =>
      http.put('meetings/$meetingId/attendance/members/$membershipId', body: {'present': present});

  Future<List<AttendanceGuest>> attendanceGuests(String meetingId) async =>
      _list(await http.get('meetings/$meetingId/attendance/guests', cache: false), AttendanceGuest.fromJson);
  Future<void> addAttendanceGuest(String meetingId, String guestId) =>
      http.post('meetings/$meetingId/attendance/guests', body: {'guestId': guestId});
  Future<void> updateAttendanceGuest(String meetingId, String rowId, {bool? present, String? name}) =>
      http.patch('meetings/$meetingId/attendance/guests/$rowId', body: {'present': ?present, 'name': ?name});
  Future<void> deleteAttendanceGuest(String meetingId, String rowId) =>
      http.delete('meetings/$meetingId/attendance/guests/$rowId');
  Future<void> markAllAttendance(String meetingId, bool present) =>
      http.put('meetings/$meetingId/attendance/mark-all', body: {'present': present});

  // ── Voting ──
  Future<List<VoteCategory>> voteCandidates(String meetingId) async =>
      _list(_map(await http.get('meetings/$meetingId/vote/candidates', cache: false))['categories'], VoteCategory.fromJson);
  Future<void> syncVoteCandidates(String meetingId) => http.post('meetings/$meetingId/vote/candidates/sync');
  Future<void> setVoteCandidates(String meetingId, String category, List<VoteCandidate> candidates) =>
      http.put('meetings/$meetingId/vote/candidates/$category',
          body: {'candidates': candidates.map((c) => c.toInput()).toList()});
  Future<VoteResults> voteResults(String meetingId) async =>
      VoteResults.fromJson(_map(await http.get('meetings/$meetingId/vote/results', cache: false)));
  Future<void> clearVoteCategory(String meetingId, String category) =>
      http.delete('meetings/$meetingId/vote/results/$category');

  // ── Planner ──
  Future<List<PlannerRow>> plannerRows() async => _list(await http.get('planner-rows'), PlannerRow.fromJson);
  Future<PlannerRow> createPlannerRow() async => PlannerRow.fromJson(_map(await http.post('planner-rows')));
  Future<PlannerRow> updatePlannerRow(String id, Json patch) async =>
      PlannerRow.fromJson(_map(await http.patch('planner-rows/$id', body: patch)));
  Future<void> deletePlannerRow(String id) => http.delete('planner-rows/$id');

  // ── Club admin ──
  Future<String?> joinCode() async => _map(await http.get('clubs/join-code', cache: false))['code'] as String?;
  Future<void> updateClubProfile(Json patch) => http.patch('clubs/mine', body: patch);
  Future<Json> clubProfileRaw() async => _map(await http.get('clubs/mine', cache: false));

  Future<void> createMember({required String name, String? phone, required List<String> roles}) => http.post('members',
      body: {'name': name, if (phone != null && phone.isNotEmpty) 'phone': phone, 'roles': roles});
  Future<Json> bulkCreateMembers(List<Json> members) async =>
      _map(await http.post('members/bulk', body: {'members': members}));
  Future<void> updateMember(String id, Json patch) => http.patch('members/$id', body: patch);
  Future<void> setMemberStatus(String id, String status) => http.post('members/$id/status', body: {'status': status});
  Future<void> setMemberAdmin(String id, bool isAdmin) => http.post('members/$id/admin', body: {'isClubAdmin': isAdmin});
  Future<void> setMemberPermissions(String id, Map<String, String> changes) =>
      http.patch('members/$id/permissions', body: changes);
  Future<void> convertGuest(String guestId, List<String> roles) =>
      http.post('guests/$guestId/convert-to-member', body: {'roles': roles});

  Future<List<Invite>> invites() async => _list(await http.get('invites', cache: false), Invite.fromJson);
  Future<Invite> createInvite({required String inviteeName, required List<String> roles, String? membershipId}) async =>
      Invite.fromJson(_map(await http.post('invites',
          body: {'inviteeName': inviteeName, 'roles': roles, 'membershipId': ?membershipId})));
  Future<void> revokeInvite(String id) => http.delete('invites/$id');

  // ── Org tree ──
  Future<List<OrgNode>> orgList(OrgLevel level, {String? parentId}) async => _list(
        await http.get(level.path,
            query: parentId == null || level.parentField == null ? null : {level.parentField!: parentId}),
        level.parse,
      );
  Future<void> orgCreate(OrgLevel level, Json body) => http.post(level.path, body: body);
  Future<void> orgUpdate(OrgLevel level, String id, Json body) => http.patch('${level.path}/$id', body: body);
  Future<void> orgDelete(OrgLevel level, String id) => http.delete('${level.path}/$id');

  // ── Platform users ──
  Future<UsersPage> users({String? search, int page = 1, int pageSize = 25}) async => UsersPage.fromJson(_map(
      await http.get('users', cache: false, query: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (page > 1) 'page': page,
        'pageSize': pageSize,
      })));
  Future<Json> createUser(Json body) async => _map(await http.post('users', body: body));
  Future<void> updateUser(String id, Json patch) => http.patch('users/$id', body: patch);
  Future<void> setUserStatus(String id, String status) => http.patch('users/$id/status', body: {'status': status});
  Future<void> setUserAdmin(String id, bool isSuperAdmin) =>
      http.patch('users/$id/admin', body: {'isSuperAdmin': isSuperAdmin});
  Future<void> setUserPassword(String id, String password) =>
      http.post('users/$id/password', body: {'password': password});
  Future<List<Member>> userMemberships(String id) async =>
      _list(await http.get('users/$id/memberships', cache: false), Member.fromJson);
  Future<void> addUserMembership(String id, Json body) => http.post('users/$id/memberships', body: body);
  Future<void> updateUserMembership(String userId, String membershipId, Json body) =>
      http.patch('users/$userId/memberships/$membershipId', body: body);
  Future<List<OrgRoleAssignment>> userOrgAssignments(String id) async =>
      _list(await http.get('users/$id/org-assignments', cache: false), OrgRoleAssignment.fromJson);
  Future<void> addUserOrgAssignment(String id, {required String role, required String unitType, required String unitId}) =>
      http.post('users/$id/org-assignments', body: {'role': role, 'unitType': unitType, 'unitId': unitId});
  Future<void> removeUserOrgAssignment(String userId, String assignmentId) =>
      http.delete('users/$userId/org-assignments/$assignmentId');

  // ── WhatsApp ──
  Future<WhatsappStatus> whatsappStatus() async =>
      WhatsappStatus.fromJson(_map(await http.get('whatsapp/status', cache: false)));
  Future<void> whatsappConnect() => http.post('whatsapp/connect');
  Future<void> whatsappDisconnect() => http.post('whatsapp/disconnect');
  Future<void> whatsappTest(String phone) => http.post('whatsapp/test-message', body: {'phone': phone});

  // ── Uploads ──
  /// Uploads [bytes] for [surface] (avatar, guestAvatar, clubBanner, …) and
  /// returns the value to store on the record: the storage key on the S3
  /// backend, or an inline data URL when the server runs without a bucket.
  Future<String> upload(Uint8List bytes, {required String surface, required String mimeType}) async {
    final signed = _map(await http.post('uploads/sign',
        body: {'surface': surface, 'mimeType': mimeType, 'sizeBytes': bytes.length}));
    if (signed['mode'] == 'inline') return 'data:$mimeType;base64,${base64Encode(bytes)}';
    final url = signed['url'] as String;
    final res = await Dio().put<dynamic>(
      url,
      data: Stream.fromIterable([bytes]),
      options: Options(headers: {'content-type': mimeType, 'content-length': bytes.length}),
    );
    if ((res.statusCode ?? 500) >= 300) throw Exception('Upload failed (${res.statusCode}). Please try again.');
    return signed['key'] as String;
  }
}
