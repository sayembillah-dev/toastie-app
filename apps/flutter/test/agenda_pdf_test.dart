import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:toastie/core/bd_time.dart';
import 'package:toastie/data/models.dart';
import 'package:toastie/domain/pathways.dart';
import 'package:toastie/features/meetings/agenda_screen.dart';
import 'package:toastie/features/meetings/agenda_sheet.dart';

AgendaData _sample() => AgendaData(
      meetingId: 'm1',
      meetingNumber: 42,
      // 7:00 PM in Dhaka — an evening meeting, so TMOE.
      dateTime: BdTime.fromWall(2026, 10, 20, 19, 0),
      theme: 'Courage — “the first step”',
      clubName: 'Nifty Toastmasters Club',
      bannerColorCss: '#772432',
      officers: {
        'President': ['Rahim Uddin'],
        'VPE': ['Nadia Islam'],
      },
      roles: [
        (roleKey: 'sergeant-at-arms', name: 'Karim'),
        (roleKey: 'president', name: 'Rahim Uddin'),
        (roleKey: 'toastmaster', name: 'আলামিন Rahman'),
        (roleKey: 'general-evaluator', name: 'Sara'),
        (roleKey: 'timer', name: 'Nadia'),
      ],
      speakers: [
        AgendaSpeaker(
            order: 1, kind: 'prepared', title: 'Ice Breaker', speakerName: 'Rafi', evaluatorName: 'Sara',
            pathway: 'Dynamic Leadership', project: 'Ice Breaker'),
        AgendaSpeaker(order: 2, kind: 'keynote', title: '', speakerName: '', evaluatorName: '', duration: 10),
      ],
      word: const WordOfTheDay(word: 'Resilient', partOfSpeech: 'adjective', meaning: 'Able to recover', example: 'She’s resilient.'),
      topics: const [],
    );

PathwayProject? _find(String name) =>
    name == 'Ice Breaker' ? const PathwayProject(name: 'Ice Breaker', level: 1, speechTime: '4–6 minutes') : null;

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en_GB');
    await initializeDateFormatting('en_US');
  });

  test('run-of-show matches the web timing rule', () {
    final rows = buildSheetRows(_sample(), _find);
    final times = [for (final r in rows) BdTime.time(r.startsAt)];
    expect(rows.first.title, 'Sergeant at Arms opens the floor');
    expect(rows[2].title, 'Introduction of the Toast Master of the Evening');
    expect(times.take(6), ['7:00 PM', '7:10 PM', '7:20 PM', '7:21 PM', '7:23 PM', '7:33 PM']);
    // Prepared speech session: objectives 2 + speech 4 (project's low end) + keynote 10.
    final speeches = rows[5];
    expect([for (final l in speeches.lines) l.label], [
      'Evaluator explains Objectives',
      '1. Ice Breaker',
      'Dynamic Leadership  ·  1  ·  Project: Ice Breaker',
      '2. Keynote: Title to be confirmed',
    ]);
    expect(speeches.displayMinutes, 16);
    expect(BdTime.time(rows[6].startsAt), '7:49 PM');
    expect(rows.any((r) => [r.title, for (final l in r.lines) l.label].any((t) => t.contains('Harkmaster'))), isFalse);
    expect(rows.last.title, 'Meeting Conclusion');
  });

  test('an assigned Harkmaster sits with the functionaries and reports last', () {
    final base = _sample();
    final a = AgendaData(
      meetingId: base.meetingId,
      meetingNumber: base.meetingNumber,
      dateTime: base.dateTime,
      theme: base.theme,
      clubName: base.clubName,
      roles: [...base.roles, (roleKey: 'harkmaster', name: 'Akter')],
      speakers: base.speakers,
      word: base.word,
      topics: const [],
    );
    final rows = buildSheetRows(a, _find);
    final ge = rows.firstWhere((r) => r.title.endsWith('introduces the General Evaluator'));
    expect([for (final l in ge.lines) l.label], ['Ah Counter', 'Timer', 'Grammarian', 'Harkmaster']);
    expect(ge.lines.last.person, 'Akter');
    final evals = rows.firstWhere((r) => r.title.endsWith('invites General Evaluator'));
    expect(evals.lines.last.label, "Harkmaster's Report");
    expect(evals.lines.last.minutes, 3);
    expect(evals.displayMinutes, 29);
    expect(rows.where((r) => r.title.contains('Harkmaster')), isEmpty);
    expect(BdTime.time(rows.last.startsAt), '8:41 PM');
  });

  testWidgets('sheet HTML carries the web layout', (tester) async {
    final a = _sample();
    final assets = await tester.runAsync(() => SheetAssets.load());
    final html = agendaSheetHtml(a, buildSheetRows(a, _find), assets!);
    expect(html, contains('@page{size:A4 portrait;margin:0}'));
    expect(html, contains("font-family:'Arimo'"));
    expect(html, contains('20-Oct-2026'));
    expect(html, contains('October 20, 2026'));
    expect(html, contains('Theme of the day: &nbsp;<strong>Courage — “the first step”</strong>'));
    expect(html, contains('VP Public Relations'));
    expect(html, contains('2.&nbsp;To be confirmed'));
    final out = Platform.environment['AGENDA_HTML_OUT'];
    if (out != null) File(out).writeAsStringSync(html);
  });
}
