import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/core/config.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:toastie/core/bd_time.dart';
import 'package:toastie/data/models.dart';
import 'package:toastie/domain/meeting_rules.dart';
import 'package:toastie/domain/pathways.dart';
import 'package:toastie/features/live/role_state.dart';

Meeting meeting({int number = 55, String iso = '2026-10-16T04:30:00.000Z', String theme = 'Expect The Unexpected'}) =>
    Meeting.fromJson({
      'id': 'm1',
      'clubId': 'c1',
      'meetingNumber': number,
      'dateTime': iso,
      'theme': theme,
      'status': 'draft',
      'shareToken': 'tok',
    });

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en_GB');
    await initializeDateFormatting('en_US');
  });

  test('relative API paths resolve under /api/', () {
    final uri = RequestOptions(baseUrl: AppConfig.apiBaseUrl, path: 'auth/login').uri;
    expect(uri.path, '/api/auth/login');
  });

  group('Bangladesh time', () {
    test('formats in UTC+6 regardless of device zone', () {
      final i = DateTime.parse('2026-10-16T04:30:00.000Z');
      expect(BdTime.time(i), '10:30 AM');
      expect(BdTime.shortDate(i), 'Fri, 16 Oct 2026');
      expect(BdTime.longDate(i), 'Friday, 16 October 2026');
    });

    test('date rolls over at Dhaka midnight, not UTC midnight', () {
      final i = DateTime.parse('2026-10-15T19:00:00.000Z'); // 01:00 on the 16th in Dhaka
      expect(BdTime.dateKey(i), '2026-10-16');
    });

    test('fromWall round-trips', () {
      final i = BdTime.fromWall(2026, 10, 16, 19, 0);
      expect(i.toIso8601String(), '2026-10-16T13:00:00.000Z');
      expect(BdTime.time(i), '7:00 PM');
    });

    test('TMOD before 17:00, TMOE from 17:00 Dhaka time', () {
      expect(toastmasterLabel(DateTime.parse('2026-10-16T10:59:00Z')), 'Toast Master of the Day');
      expect(toastmasterLabel(DateTime.parse('2026-10-16T11:00:00Z')), 'Toast Master of the Evening');
    });
  });

  group('meeting partition', () {
    test('a meeting stays current until two hours after it starts', () {
      final m = meeting(iso: '2026-10-16T04:30:00.000Z');
      expect(m.isPast(DateTime.parse('2026-10-16T06:29:00Z')), isFalse);
      expect(m.isLive(DateTime.parse('2026-10-16T05:00:00Z')), isTrue);
      expect(m.isPast(DateTime.parse('2026-10-16T06:30:00Z')), isTrue);
    });

    test('past is latest-first, upcoming soonest-first', () {
      final a = meeting(number: 1, iso: '2026-01-01T10:00:00Z');
      final b = meeting(number: 2, iso: '2026-02-01T10:00:00Z');
      final c = meeting(number: 3, iso: '2026-12-01T10:00:00Z');
      final d = meeting(number: 4, iso: '2026-11-01T10:00:00Z');
      final p = MeetingPartition.of([c, a, d, b], DateTime.parse('2026-06-01T00:00:00Z'));
      expect(p.past.map((m) => m.meetingNumber), [2, 1]);
      expect(p.upcoming.map((m) => m.meetingNumber), [4, 3]);
      expect(p.current?.meetingNumber, 4);
    });
  });

  test('caption matches the web template', () {
    final m = meeting();
    final club = Club(id: 'c1', name: 'Nifty Toastmasters Club', venueAddress: 'Dhaka 1215', venueMapUrl: 'https://maps.example');
    final caption = buildMeetingCaption(m, club, generalEvaluator: 'A', tableTopicsMaster: '', toastmaster: 'B');
    expect(caption, startsWith('📢 55th General Meeting | Nifty Toastmasters Club 🎙️'));
    expect(caption, contains('💬 “Expect The Unexpected”'));
    expect(caption, contains('🎯 General Evaluator — A'));
    expect(caption, isNot(contains('Table Topics Master')));
    expect(caption, contains('🎤 Toastmaster of the Day — B'));
    expect(caption, contains('📅 Date: 16 October 2026'));
    expect(caption, contains('🕖 Time: 10:30 AM'));
    expect(caption, contains('📍 Venue: Dhaka 1215'));
  });

  group('timer state (shared JSON with web)', () {
    test('starting one speaker commits any other running speaker to done', () {
      var s = TimerState([
        TimerSpeaker({'id': 'a', 'name': 'A', 'type': 'Prepared Speaker', 'status': 'idle', 'elapsed': 0}),
        TimerSpeaker({'id': 'b', 'name': 'B', 'type': 'Table Topic', 'status': 'idle', 'elapsed': 0}),
      ], null);
      s = s.start('a', 1000);
      s = s.start('b', 61000); // a ran 60s
      final a = s.speakers.firstWhere((x) => x.id == 'a');
      expect(a.status, 'done');
      expect(a.elapsed, 60);
      expect(a.raw.containsKey('startedAt'), isFalse);
      expect(s.activeId, 'b');
      expect(s.speakers.firstWhere((x) => x.id == 'b').running, isTrue);
    });

    test('lights follow the speaker type brackets', () {
      final tt = TimerSpeaker({'id': 'x', 'name': 'X', 'type': 'Table Topic', 'status': 'idle', 'elapsed': 0});
      expect(tt.lightAt(59), Light.none);
      expect(tt.lightAt(60), Light.green);
      expect(tt.lightAt(90), Light.yellow);
      expect(tt.lightAt(120), Light.red);
    });

    test('a project range sets green/red at the bounds and yellow halfway', () {
      final b = Bracket.fromMinutes(5, 7);
      expect([b.green, b.yellow, b.red], [300, 360, 420]);
    });

    test('unknown keys from a newer web build survive a round trip', () {
      final raw = {
        'speakers': [
          {'id': 'a', 'name': 'A', 'type': 'Keynote', 'status': 'idle', 'elapsed': 0, 'futureField': 1},
        ],
        'activeId': null,
        'futureTop': true,
      };
      final out = jsonDecode(jsonEncode(TimerState.fromJson(raw).toJson())) as Map;
      expect(out['futureTop'], isTrue);
      expect((out['speakers'] as List).first['futureField'], 1);
    });
  });

  test('ah-counter never goes below zero', () {
    var s = AhState(['AH', 'UM'], [AhSpeaker({'id': 'a', 'name': 'A', 'counts': <String, int>{}})]);
    s = s.bump('a', 'AH', 1).bump('a', 'AH', 1).bump('a', 'UM', -1);
    expect(s.speakers.first.counts, {'AH': 2, 'UM': 0});
    expect(s.speakers.first.total(['AH', 'UM']), 2);
  });

  test('take-from-agenda updates agenda rows, adopts manual rows, keeps the rest', () {
    final rows = [
      {'id': '1', 'name': 'Old', 'agendaKey': 'speaker:s1', 'elapsed': 30},
      {'id': '2', 'name': 'Typed', 'memberId': 'm2'},
      {'id': '3', 'name': 'Walk-in'},
    ];
    final sources = [
      AgendaSource(agendaKey: 'speaker:s1', name: 'New', role: 'speaker', kind: 'prepared', memberId: 'm1'),
      AgendaSource(agendaKey: 'role:general-evaluator', name: 'GE', role: 'general-evaluator', kind: 'prepared', memberId: 'm2'),
    ];
    final out = mergeAgenda(rows, sources, (s, e) => {...?e, 'id': e?['id'] ?? 'new', 'name': s.name, 'agendaKey': s.agendaKey});
    expect(out.map((r) => r['id']), ['1', '2', '3']);
    expect(out[0]['name'], 'New');
    expect(out[0]['elapsed'], 30);
    expect(out[1]['agendaKey'], 'role:general-evaluator');
    expect(out[2]['name'], 'Walk-in');
  });

  test('bundled pathway catalog has 11 pathways of 5 levels', () {
    final raw = jsonDecode(File('assets/pathway.json').readAsStringSync()) as Map<String, dynamic>;
    final list = raw['pathways'] as List;
    expect(list.length, 11);
    expect(list.every((p) => (p['levels'] as List).length == 5), isTrue);
  });

  test('pathway progress matches the web card', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    final raw = jsonDecode(File('assets/pathway.json').readAsStringSync()) as Map<String, dynamic>;
    final dl = (raw['pathways'] as List).first as Map<String, dynamic>;
    final l1 = (dl['levels'] as List).first as Map<String, dynamic>;
    final req = [for (final r in l1['required_projects'] as List) PathwayProject(name: r['name'] as String, level: 1, speechTime: r['speech_time'] as String?)];
    final cat = PathwayCatalog([
      Pathway(id: 'dl', name: 'Dynamic Leadership', description: '', levels: [
        PathwayLevel(level: 1, title: 'L1', required: req, electives: const []),
      ]),
    ]);
    final p = cat.progress(
      pathway: 'Dynamic Leadership',
      level: 1,
      currentProject: 'Evaluation and Feedback (Serve as Speech Evaluator)',
      history: const [],
    )!;
    expect(p.leftInLevel, req.length);
    expect(p.next?.name, 'Ice Breaker');
    final after = cat.progress(
      pathway: 'Dynamic Leadership',
      level: 1,
      currentProject: null,
      history: [(type: 'project-completed', projectName: 'Ice Breaker', pathway: 'Dynamic Leadership', level: 1)],
    )!;
    expect(after.leftInLevel, req.length - 1);
    expect(after.next?.name, isNot('Ice Breaker'));
  });
}
