import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models.dart';
import 'session.dart';

/// Data providers. Each one watches [contextKeyProvider], so switching the
/// active club rebuilds them from scratch instead of showing stale data from
/// the previous club.

final clubProvider = FutureProvider<Club>((ref) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).myClub();
});

final meetingsProvider = FutureProvider<List<Meeting>>((ref) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).meetings();
});

final meetingProvider = FutureProvider.family<Meeting, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).meeting(id);
});

final meetingRolesProvider = FutureProvider.family<List<RoleAssignment>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).meetingRoles(id);
});

final speakersProvider = FutureProvider.family<List<PreparedSpeaker>, String>((ref, id) async {
  ref.watch(contextKeyProvider);
  final list = await ref.watch(apiProvider).speakers(id);
  return list..sort((a, b) => a.order.compareTo(b.order));
});

final tableTopicsProvider = FutureProvider.family<List<TableTopic>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).tableTopics(id);
});

final publicAgendaProvider = FutureProvider.family<PublicAgenda, String>((ref, id) {
  return ref.watch(apiProvider).publicAgenda(id);
});

final membersProvider = FutureProvider<List<Member>>((ref) async {
  ref.watch(contextKeyProvider);
  final list = await ref.watch(apiProvider).members();
  return list..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
});

final guestsProvider = FutureProvider<List<Guest>>((ref) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).guests();
});

final guestProvider = FutureProvider.family<Guest, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).guest(id);
});

final visitLogsProvider = FutureProvider.family<List<VisitLog>, String>((ref, guestId) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).visitLogs(guestId);
});

final contactLogsProvider = FutureProvider.family<List<ContactLog>, String>((ref, guestId) async {
  ref.watch(contextKeyProvider);
  final list = await ref.watch(apiProvider).contactLogs(guestId);
  return list..sort((a, b) => (b.createdAt ?? '').compareTo(a.createdAt ?? ''));
});

final memberProvider = FutureProvider.family<Member, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).member(id);
});

final memberStatsProvider = FutureProvider.family<MemberStats, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).memberStats(id);
});

final memberHistoryProvider = FutureProvider.family<List<HistoryEvent>, String>((ref, id) async {
  ref.watch(contextKeyProvider);
  final list = await ref.watch(apiProvider).memberHistory(id);
  return list..sort((a, b) => b.date.compareTo(a.date));
});

final receivedEvaluationsProvider = FutureProvider.family<List<ReceivedEvaluation>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).receivedEvaluations(id);
});

final timerEntriesProvider = FutureProvider.family<List<TimerReport>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).timerEntries(id);
});

final ahEntriesProvider = FutureProvider.family<List<AhReport>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).ahEntries(id);
});

final speechSlotRequestsProvider = FutureProvider.family<List<SpeechSlotRequest>, String>((ref, id) async {
  ref.watch(contextKeyProvider);
  final list = await ref.watch(apiProvider).speechSlotRequests(id);
  return list..sort((a, b) => (b.requestedAt ?? '').compareTo(a.requestedAt ?? ''));
});

final profileProvider = FutureProvider<Profile>((ref) {
  ref.watch(signedInProvider.select((s) => s?.session.user.id));
  return ref.watch(apiProvider).profile();
});

/// id → display name for members and guests, so role rows and speaker cards
/// can name whoever fills a slot.
class People {
  People(this.members, this.guests);
  final List<Member> members;
  final List<Guest> guests;

  late final Map<String, Member> _m = {for (final m in members) m.id: m};
  late final Map<String, Guest> _g = {for (final g in guests) g.id: g};

  Member? member(String? id) => id == null ? null : _m[id];
  Guest? guest(String? id) => id == null ? null : _g[id];

  String? name({String? membershipId, String? guestId}) {
    if (membershipId != null) return _m[membershipId]?.name ?? 'Unknown member';
    if (guestId != null) return _g[guestId]?.name ?? 'Unknown guest';
    return null;
  }

  Assignee? assignee({String? membershipId, String? guestId}) {
    if (membershipId != null) return Assignee.member(membershipId, name(membershipId: membershipId)!);
    if (guestId != null) return Assignee.guest(guestId, name(guestId: guestId)!);
    return null;
  }
}

/// Members plus guests. Guests are optional — a member without guest read
/// access still gets names for every member slot.
final peopleProvider = FutureProvider<People>((ref) async {
  final members = await ref.watch(membersProvider.future);
  List<Guest> guests;
  try {
    guests = await ref.watch(guestsProvider.future);
  } catch (_) {
    guests = const [];
  }
  return People(members, guests);
});
