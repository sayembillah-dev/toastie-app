import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/data.dart';
import '../../data/models.dart';
import '../../data/toastie_api.dart';
import '../../domain/pathways.dart';

/// Live-tool state shared with the web app through
/// `GET/PUT /meetings/:id/role-state/:kind` (one JSON blob per meeting and
/// tool). The JSON shapes here MUST match `apps/web/src/lib/meetings/role-state.ts`
/// — web and phone edit the same blob. Unknown keys are preserved on every
/// object so a newer web build's fields survive a round trip through the app.

String newId() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

Map<String, dynamic> _m(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<Map<String, dynamic>> _ms(Object? v) => v is List ? v.whereType<Map>().map(_m).toList() : [];
String? _so(Object? v) => v is String && v.isNotEmpty ? v : null;
Map<String, dynamic> _clean(Map<String, dynamic> m) => m..removeWhere((_, v) => v == null);

// ───────────────────────── Timer ─────────────────────────

// Table Topic first: it's the default pick when adding a speaker.
const timerSpeakerTypes = [
  'Table Topic',
  'Ice Breaker',
  'Prepared Speaker',
  'Keynote',
  'TT Evaluator',
  'Speech Evaluator',
  'General Evaluator',
];

class Bracket {
  const Bracket(this.green, this.yellow, this.red);
  final num green;
  final num yellow;
  final num red;

  factory Bracket.fromJson(Map<String, dynamic> j) =>
      Bracket(j['green'] as num? ?? 0, j['yellow'] as num? ?? 0, j['red'] as num? ?? 0);
  Map<String, dynamic> toJson() => {'green': green, 'yellow': yellow, 'red': red};

  /// A speech's own range: green and red at the bounds, yellow halfway.
  factory Bracket.fromMinutes(int min, int max) {
    final g = min * 60;
    final r = max * 60;
    return Bracket(g, ((g + r) / 2).round(), r);
  }
}

const defaultBrackets = <String, Bracket>{
  'Prepared Speaker': Bracket(300, 360, 420),
  'Keynote': Bracket(900, 1080, 1200),
  'Ice Breaker': Bracket(240, 300, 360),
  'Table Topic': Bracket(60, 90, 120),
  'Speech Evaluator': Bracket(120, 150, 180),
  'TT Evaluator': Bracket(120, 150, 180),
  'General Evaluator': Bracket(300, 360, 420),
};

enum Light { none, green, yellow, red }

class TimerSpeaker {
  TimerSpeaker(this.raw);
  final Map<String, dynamic> raw;

  String get id => raw['id'] as String? ?? '';
  String get name => raw['name'] as String? ?? '';
  String get type => raw['type'] as String? ?? 'Prepared Speaker';
  String get status => raw['status'] as String? ?? 'idle'; // idle | running | done
  num get elapsed => raw['elapsed'] as num? ?? 0; // seconds
  int? get startedAt => (raw['startedAt'] as num?)?.toInt(); // epoch ms
  String? get memberId => _so(raw['memberId']);
  String? get guestId => _so(raw['guestId']);
  String? get agendaKey => _so(raw['agendaKey']);
  Bracket get brackets {
    final b = raw['brackets'];
    if (b is Map) return Bracket.fromJson(_m(b));
    return defaultBrackets[type] ?? defaultBrackets['Prepared Speaker']!;
  }

  bool get running => status == 'running' && startedAt != null;

  double elapsedAt(int nowMs) =>
      running ? elapsed + max(0, (nowMs - startedAt!) / 1000) : elapsed.toDouble();

  Light lightAt(double secs) {
    final b = brackets;
    if (secs >= b.red) return Light.red;
    if (secs >= b.yellow) return Light.yellow;
    if (secs >= b.green) return Light.green;
    return Light.none;
  }

  TimerSpeaker copyWith(Map<String, dynamic> patch) => TimerSpeaker(_clean({...raw, ...patch}));
}

class TimerState {
  TimerState(this.speakers, this.activeId, [this.extra = const {}]);
  final List<TimerSpeaker> speakers;
  final String? activeId;
  final Map<String, dynamic> extra;

  static TimerState empty() => TimerState([], null);
  factory TimerState.fromJson(Map<String, dynamic> j) =>
      TimerState(_ms(j['speakers']).map(TimerSpeaker.new).toList(), _so(j['activeId']), j);
  Map<String, dynamic> toJson() => {
        ...extra,
        'speakers': speakers.map((s) => s.raw).toList(),
        'activeId': activeId,
      };

  TimerSpeaker? get active => speakers.where((s) => s.id == activeId).firstOrNull;

  TimerState copyWith({List<TimerSpeaker>? speakers, String? activeId, bool clearActive = false}) =>
      TimerState(speakers ?? this.speakers, clearActive ? null : (activeId ?? this.activeId), extra);

  /// Start [id]; any other running speaker commits to done — one on the clock.
  TimerState start(String id, int nowMs) => copyWith(
        activeId: id,
        speakers: [
          for (final s in speakers)
            if (s.id == id)
              s.copyWith({'status': 'running', 'startedAt': nowMs})
            else if (s.running)
              s.copyWith({'status': 'done', 'elapsed': s.elapsedAt(nowMs), 'startedAt': null})
            else
              s,
        ],
      );

  TimerState stop(String id, int nowMs) => copyWith(speakers: [
        for (final s in speakers)
          if (s.id == id && s.running)
            s.copyWith({'status': 'done', 'elapsed': s.elapsedAt(nowMs), 'startedAt': null})
          else
            s,
      ]);

  TimerState reset(String id) => copyWith(speakers: [
        for (final s in speakers)
          if (s.id == id) s.copyWith({'status': 'idle', 'elapsed': 0, 'startedAt': null}) else s,
      ]);
}

// ───────────────────────── Ah-Counter ─────────────────────────

const ahDefaultCategories = ['AH', 'UM', 'ERR', 'THE'];

class AhSpeaker {
  AhSpeaker(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'] as String? ?? '';
  String get name => raw['name'] as String? ?? '';
  String? get memberId => _so(raw['memberId']);
  String? get guestId => _so(raw['guestId']);
  String? get agendaKey => _so(raw['agendaKey']);
  Map<String, int> get counts => _m(raw['counts']).map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0));
  int total(List<String> categories) => categories.fold(0, (a, c) => a + (counts[c] ?? 0));
  AhSpeaker copyWith(Map<String, dynamic> patch) => AhSpeaker(_clean({...raw, ...patch}));
}

class AhState {
  AhState(this.categories, this.speakers, [this.extra = const {}]);
  final List<String> categories;
  final List<AhSpeaker> speakers;
  final Map<String, dynamic> extra;

  static AhState empty() => AhState([...ahDefaultCategories], []);
  factory AhState.fromJson(Map<String, dynamic> j) => AhState(
        j['categories'] is List ? (j['categories'] as List).map((e) => '$e').toList() : [...ahDefaultCategories],
        _ms(j['speakers']).map(AhSpeaker.new).toList(),
        j,
      );
  Map<String, dynamic> toJson() => {
        ...extra,
        'categories': categories,
        'speakers': speakers.map((s) => s.raw).toList(),
      };

  AhState copyWith({List<String>? categories, List<AhSpeaker>? speakers}) =>
      AhState(categories ?? this.categories, speakers ?? this.speakers, extra);

  AhState bump(String speakerId, String category, int delta) => copyWith(speakers: [
        for (final s in speakers)
          if (s.id == speakerId)
            s.copyWith({
              'counts': {...s.counts, category: max(0, (s.counts[category] ?? 0) + delta)},
            })
          else
            s,
      ]);
}

// ───────────────────────── Grammarian ─────────────────────────

class GrammarianEntry {
  GrammarianEntry(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'] as String? ?? '';
  String get said => raw['said'] as String? ?? '';
  String get corrected => raw['corrected'] as String? ?? '';
  int get createdAt => (raw['createdAt'] as num?)?.toInt() ?? 0;
}

class WotdSpeaker {
  WotdSpeaker(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'] as String? ?? '';
  String get name => raw['name'] as String? ?? '';
  String? get memberId => _so(raw['memberId']);
  String? get guestId => _so(raw['guestId']);
  int get count => (raw['count'] as num?)?.toInt() ?? 0;
  WotdSpeaker copyWith(Map<String, dynamic> patch) => WotdSpeaker(_clean({...raw, ...patch}));
}

class GrammarianState {
  GrammarianState(this.entries, this.wotdSpeakers, [this.extra = const {}]);
  final List<GrammarianEntry> entries;
  final List<WotdSpeaker> wotdSpeakers;
  final Map<String, dynamic> extra;

  static GrammarianState empty() => GrammarianState([], []);
  factory GrammarianState.fromJson(Map<String, dynamic> j) => GrammarianState(
        _ms(j['entries']).map(GrammarianEntry.new).toList(),
        _ms(j['wotdSpeakers']).map(WotdSpeaker.new).toList(),
        j,
      );
  Map<String, dynamic> toJson() => {
        ...extra,
        'entries': entries.map((e) => e.raw).toList(),
        'wotdSpeakers': wotdSpeakers.map((s) => s.raw).toList(),
      };
  GrammarianState copyWith({List<GrammarianEntry>? entries, List<WotdSpeaker>? wotdSpeakers}) =>
      GrammarianState(entries ?? this.entries, wotdSpeakers ?? this.wotdSpeakers, extra);
}

// ───────────────────────── Sync controller ─────────────────────────

/// Stable stringify (sorted keys, nulls dropped) — JSONB doesn't preserve key
/// order, so a textual compare would see phantom changes on every poll.
String _stable(Object? v) {
  if (v is Map) {
    final keys = v.keys.map((k) => '$k').where((k) => v[k] != null).toList()..sort();
    return '{${keys.map((k) => '${jsonEncode(k)}:${_stable(v[k])}').join(',')}}';
  }
  if (v is List) return '[${v.map(_stable).join(',')}]';
  return jsonEncode(v);
}

/// Mirrors the web's sync rules: local edits debounce 700 ms then PUT; a
/// 5 s poll adopts the server copy unless there are unsaved local edits
/// (local wins while dirty). The last state is kept on disk so counts
/// survive a dead connection or an app kill, and are pushed on reconnect.
class RoleStateController<T> extends ChangeNotifier {
  RoleStateController({
    required this.api,
    required this.meetingId,
    required this.kind,
    required this.fromJson,
    required this.toJson,
    required T empty,
    this.token,
  }) : _state = empty;

  final ToastieApi api;
  final String meetingId;
  final String kind; // timer | ah-counter | grammarian
  final T Function(Map<String, dynamic>) fromJson;
  final Map<String, dynamic> Function(T) toJson;
  final String? token;

  T _state;
  T get state => _state;
  bool loaded = false;
  bool offline = false;
  bool _dirty = false;
  bool _saving = false;
  Timer? _debounce;
  Timer? _poll;
  bool _disposed = false;

  String get _prefsKey => 'roleState:$kind:$meetingId';

  Future<void> start() async {
    // Instant paint from the device copy, then reconcile with the server.
    try {
      final p = await SharedPreferences.getInstance();
      final s = p.getString(_prefsKey);
      if (s != null) {
        final j = jsonDecode(s) as Map<String, dynamic>;
        _state = fromJson(_m(j['state']));
        _dirty = j['dirty'] == true;
        loaded = true;
        _notify();
      }
    } catch (_) {}
    await _pull();
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _pull());
  }

  void update(T Function(T) fn) {
    _state = fn(_state);
    _dirty = true;
    _persistLocal();
    _notify();
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 700), _push);
  }

  Future<void> _pull() async {
    if (_disposed) return;
    if (_dirty && !_saving && _debounce?.isActive != true) {
      // A save failed earlier (offline) — retry it before adopting anything.
      await _push();
      return;
    }
    if (_dirty || _saving) return;
    try {
      final remote = await api.roleState(meetingId, kind, token: token);
      offline = false;
      if (_dirty || _saving || _disposed) return;
      if (remote.state == null) {
        loaded = true;
        _notify();
        return;
      }
      if (_stable(remote.state) != _stable(toJson(_state))) {
        _state = fromJson(remote.state!);
        _persistLocal();
      }
      loaded = true;
      _notify();
    } catch (_) {
      offline = true;
      loaded = true;
      _notify();
    }
  }

  Future<void> _push() async {
    if (_disposed && !_dirty) return;
    _saving = true;
    final snapshot = toJson(_state);
    try {
      await api.saveRoleState(meetingId, kind, snapshot, token: token);
      offline = false;
      // Only clear dirty if nothing changed while the request was in flight.
      if (_stable(snapshot) == _stable(toJson(_state)) && _debounce?.isActive != true) _dirty = false;
      _persistLocal();
    } catch (_) {
      offline = true;
    } finally {
      _saving = false;
      _notify();
    }
  }

  Future<void> _persistLocal() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_prefsKey, jsonEncode({'state': toJson(_state), 'dirty': _dirty}));
    } catch (_) {}
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  /// Flush any pending edit before the screen goes away.
  @override
  void dispose() {
    _disposed = true;
    _poll?.cancel();
    if (_debounce?.isActive == true) {
      _debounce!.cancel();
      unawaited(_push());
    }
    super.dispose();
  }
}

// ───────────────────────── Agenda sources ─────────────────────────

/// Who can be pulled onto a live tool's list from the agenda ("Take from
/// agenda"), keyed so a second pull updates rows instead of duplicating them.
class AgendaSource {
  AgendaSource({
    required this.agendaKey,
    required this.name,
    required this.role, // speaker | evaluator | general-evaluator | tt-evaluator
    required this.kind,
    this.memberId,
    this.guestId,
    this.bounds,
  });
  final String agendaKey;
  final String name;
  final String role;
  final String kind;
  final String? memberId;
  final String? guestId;
  final ({int min, int max})? bounds;

  String get timerType => switch (role) {
        'speaker' => kind == 'keynote' ? 'Keynote' : 'Prepared Speaker',
        'evaluator' => 'Speech Evaluator',
        'general-evaluator' => 'General Evaluator',
        _ => 'TT Evaluator',
      };
}

List<AgendaSource> buildAgendaSources(
  List<PreparedSpeaker> speakers,
  List<RoleAssignment> roles,
  People people,
  PathwayCatalog? catalog,
) {
  ({int min, int max})? boundsFor(PreparedSpeaker s) {
    if (s.isKeynote) return s.duration == null ? null : (min: s.duration!, max: s.duration! + 2);
    return catalog?.byName(s.pathway)?.findProject(s.project)?.range;
  }

  final out = <AgendaSource>[];
  for (final s in [...speakers]..sort((a, b) => a.order.compareTo(b.order))) {
    final sp = people.name(membershipId: s.membershipId, guestId: s.guestId);
    if (sp != null) {
      out.add(AgendaSource(
        agendaKey: 'speaker:${s.id}',
        name: sp,
        role: 'speaker',
        kind: s.kind,
        memberId: s.membershipId,
        guestId: s.membershipId == null ? s.guestId : null,
        bounds: boundsFor(s),
      ));
    }
    final ev = people.name(membershipId: s.evaluatorMembershipId, guestId: s.evaluatorGuestId);
    if (ev != null) {
      out.add(AgendaSource(
        agendaKey: 'speaker-evaluator:${s.id}',
        name: ev,
        role: 'evaluator',
        kind: s.kind,
        memberId: s.evaluatorMembershipId,
        guestId: s.evaluatorMembershipId == null ? s.evaluatorGuestId : null,
      ));
    }
  }
  for (final (key, role) in const [('general-evaluator', 'general-evaluator'), ('table-topic-evaluator', 'tt-evaluator')]) {
    final r = roles.where((x) => x.roleKey == key).firstOrNull;
    final n = people.name(membershipId: r?.membershipId, guestId: r?.guestId);
    if (r != null && n != null) {
      out.add(AgendaSource(
        agendaKey: 'role:$key',
        name: n,
        role: role,
        kind: 'prepared',
        memberId: r.membershipId,
        guestId: r.membershipId == null ? r.guestId : null,
      ));
    }
  }
  return out;
}

/// Merge agenda sources into a list of rows: existing agenda rows update in
/// place, manual rows for the same person get adopted, the rest are new.
List<Map<String, dynamic>> mergeAgenda(
  List<Map<String, dynamic>> rows,
  List<AgendaSource> sources,
  Map<String, dynamic> Function(AgendaSource s, Map<String, dynamic>? existing) build,
) {
  final manual = rows.where((r) => _so(r['agendaKey']) == null).toList();
  final byKey = {for (final r in rows) if (_so(r['agendaKey']) != null) r['agendaKey'] as String: r};
  final next = <Map<String, dynamic>>[];
  for (final s in sources) {
    var existing = byKey[s.agendaKey];
    if (existing == null) {
      final i = manual.indexWhere((r) =>
          (s.memberId != null && r['memberId'] == s.memberId) || (s.guestId != null && r['guestId'] == s.guestId));
      if (i != -1) existing = manual.removeAt(i);
    }
    next.add(_clean(build(s, existing)));
  }
  return [...next, ...manual];
}
