import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart';

import '../../core/bd_time.dart';
import '../../domain/meeting_rules.dart';
import '../../domain/pathways.dart';
import 'agenda_screen.dart' show AgendaData;

/// The printed meeting agenda — a port of the web's A4 sheet
/// (`apps/web/src/components/meetings/agenda-preview.tsx` and
/// `lib/meetings/agenda.ts`). The web prints that sheet through the browser;
/// here the same markup and inline styles go through the platform's own web
/// engine (`Printing.convertHtml`: Chromium WebView on Android, WebKit on iOS),
/// with the same Arimo font and Toastmasters logo bundled, so the PDF matches
/// the web's. Keep the two in lock step — any change to the web sheet's
/// layout, styles or run-of-show belongs here too.

const _rule = '#1a3f6f';
const _defaultBannerColor = '#772432';
const _a4WidthMm = 210.0;
const _a4HeightMm = 297.0;

/// The standard Toastmasters club mission — `CLUB.mission` on the web.
const clubMission =
    'We provide a supportive and positive learning experience in which members are empowered to develop communication and leadership skills, resulting in greater self-confidence and personal growth.';

/// Club officers as they print on the agenda rail — Toastmasters protocol
/// order, with the long title each office carries on paper.
const officerPrintOrder = [
  (role: 'President', label: 'President'),
  (role: 'VPE', label: 'VP Education'),
  (role: 'VPM', label: 'VP Membership'),
  (role: 'VPPR', label: 'VP Public Relations'),
  (role: 'Secretary', label: 'Secretary'),
  (role: 'Treasurer', label: 'Treasurer'),
  (role: 'SAA', label: 'Sergeant at Arms'),
];

class SheetLine {
  const SheetLine(this.label, {this.person, this.minutes, this.meta = false});
  final String label;
  final String? person;
  final int? minutes;

  /// Renders italic and grey — the pathway/project note under a speech.
  final bool meta;
}

class SheetRow {
  SheetRow({required this.title, this.person, required this.minutes, this.lines = const []});
  final String title;
  final String? person;

  /// Minutes belonging to the block itself, on top of whatever its lines take.
  final int minutes;
  final List<SheetLine> lines;
  late final DateTime startsAt;

  /// What the Min column shows: the block's own minutes, or the roll-up of its
  /// lines when the block is just a container. Null when nothing is set.
  late final int? displayMinutes;
}

typedef ProjectLookup = PathwayProject? Function(String name);

ProjectLookup projectLookup(PathwayCatalog catalog) => (name) {
      for (final p in catalog.pathways) {
        final hit = p.findProject(name);
        if (hit != null) return hit;
      }
      return null;
    };

/// `getProjectDuration(project).min` on the web: the low end of the project's
/// speech time, 5 when unknown.
int _projectMinMinutes(String? project, ProjectLookup find) {
  final time = project == null ? null : find(project)?.speechTime;
  if (time == null) return 5;
  final range = RegExp(r'(\d+)\s*[–-]\s*(\d+)').firstMatch(time);
  if (range != null) return int.parse(range.group(1)!);
  final single = RegExp(r'(\d+)\s*minute').firstMatch(time);
  if (single != null) return int.parse(single.group(1)!);
  return 5;
}

/// The club's standard run-of-show, filled in from the meeting — `buildAgenda`
/// on the web. A block advances the clock by its own minutes plus every minute
/// its lines claim.
List<SheetRow> buildSheetRows(AgendaData a, ProjectLookup find) {
  final role = {for (final r in a.roles) r.roleKey: r.name};
  String holder(String key) => role[key] ?? '';
  final tm = toastmasterAbbrev(a.dateTime);
  final president = holder('president');
  final generalEvaluator = holder('general-evaluator');
  final ahCounter = holder('ah-counter');
  final timer = holder('timer');
  final grammarian = holder('grammarian');
  final harkmaster = holder('harkmaster');

  final evaluators = <String>[];
  for (final s in a.speakers) {
    if (s.kind == 'keynote') continue;
    if (s.evaluatorName.isNotEmpty && !evaluators.contains(s.evaluatorName)) evaluators.add(s.evaluatorName);
  }

  final speechLines = <SheetLine>[];
  for (var i = 0; i < a.speakers.length; i++) {
    final s = a.speakers[i];
    if (s.kind == 'keynote') {
      final title = s.title.trim().isEmpty ? 'Title to be confirmed' : s.title.trim();
      speechLines.add(SheetLine('${i + 1}. Keynote: $title', person: s.speakerName, minutes: s.duration));
      continue;
    }
    speechLines.add(SheetLine('Evaluator explains Objectives', person: s.evaluatorName, minutes: 2));
    final title = s.title.trim().isEmpty ? 'Speech title to be confirmed' : s.title.trim();
    speechLines.add(SheetLine('${i + 1}. $title',
        person: s.speakerName, minutes: s.duration ?? _projectMinMinutes(s.project, find)));
    final level = s.project == null ? null : find(s.project!)?.level;
    final meta = [
      if (s.pathway != null && s.pathway!.isNotEmpty) s.pathway!,
      if (level != null && level != 0) '$level',
      if (s.project != null && s.project!.isNotEmpty) 'Project: ${s.project}',
    ].join('  ·  ');
    if (meta.isNotEmpty) speechLines.add(SheetLine(meta, meta: true));
  }
  if (speechLines.isEmpty) speechLines.add(const SheetLine('No prepared speakers added yet', meta: true));

  final rows = [
    SheetRow(
      title: 'Sergeant at Arms opens the floor',
      person: holder('sergeant-at-arms'),
      minutes: 10,
      lines: const [SheetLine('Ground rules'), SheetLine('Mission Statement')],
    ),
    SheetRow(
      title: 'Presiding Officer calls the Meeting to order',
      person: president,
      minutes: 0,
      lines: const [
        SheetLine('National Anthem', minutes: 5),
        SheetLine('Welcome guests & Round-Roaming Session', minutes: 5),
      ],
    ),
    SheetRow(title: 'Introduction of the ${toastmasterLabel(a.dateTime)}', person: holder('toastmaster'), minutes: 1),
    SheetRow(title: '$tm introduces the Theme of the day', minutes: 2),
    SheetRow(
      title: '$tm introduces the General Evaluator',
      person: generalEvaluator,
      minutes: 10,
      lines: [
        SheetLine('Ah Counter', person: ahCounter),
        SheetLine('Timer', person: timer),
        SheetLine('Grammarian', person: grammarian),
        // Optional role — introduced and reporting with the other
        // functionaries, but only when one is actually assigned.
        if (harkmaster.isNotEmpty) SheetLine('Harkmaster', person: harkmaster),
      ],
    ),
    SheetRow(title: 'Prepared Speech Session', minutes: 0, lines: speechLines),
    SheetRow(
      title: '$tm introduces the Table Topic Master',
      person: holder('table-topic-master'),
      minutes: 2,
      lines: const [SheetLine('Table Topic Session', minutes: 15)],
    ),
    SheetRow(
      title: '$tm invites General Evaluator',
      person: generalEvaluator,
      minutes: 0,
      lines: [
        SheetLine('Prepared Speech Evaluations', person: evaluators.join(', '), minutes: 10),
        SheetLine('Table Topic Speech Evaluations', person: holder('table-topic-evaluator'), minutes: 10),
        SheetLine("Ah Counter's Report", person: ahCounter, minutes: 2),
        SheetLine("Timer's Report", person: timer, minutes: 2),
        SheetLine("Grammarian's Report", person: grammarian, minutes: 2),
        if (harkmaster.isNotEmpty) SheetLine("Harkmaster's Report", person: harkmaster, minutes: 3),
      ],
    ),
    SheetRow(
      title: '$tm invites Presiding Officer',
      person: president,
      minutes: 2,
      lines: const [SheetLine('Feedback & Q&A', minutes: 4)],
    ),
    SheetRow(title: 'Meeting Conclusion', minutes: 0),
  ];

  var cursor = a.dateTime;
  for (final r in rows) {
    final lineMinutes = r.lines.fold<int>(0, (t, l) => t + (l.minutes ?? 0));
    r.startsAt = cursor;
    cursor = cursor.add(Duration(minutes: r.minutes + lineMinutes));
    r.displayMinutes = r.minutes != 0 ? r.minutes : (lineMinutes != 0 ? lineMinutes : null);
  }
  return rows;
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _fullMonths = [
  'January', 'February', 'March', 'April', 'May', 'June', //
  'July', 'August', 'September', 'October', 'November', 'December',
];

/// `3-Jul-2026`, the format the club's printed agenda uses.
String sheetDate(DateTime instant) {
  final w = BdTime.wall(instant);
  return '${w.day}-${_months[w.month - 1]}-${w.year}';
}

/// `September 3, 2026` — the long date that opens the officer rail.
String railDate(DateTime instant) {
  final w = BdTime.wall(instant);
  return '${_fullMonths[w.month - 1]} ${w.day}, ${w.year}';
}

/// Fonts, logo and banner image, inlined as data URIs so the page renders
/// complete the moment it loads — no network, no file access.
class SheetAssets {
  const SheetAssets({required this.fontFaces, required this.logo, this.bannerImage});
  final String fontFaces;
  final String logo;
  final String? bannerImage;

  static String? _fonts;
  static String? _logo;

  static Future<SheetAssets> load({String? bannerImageUrl}) async {
    _fonts ??= [
      for (final (file, weight, style) in const [
        ('Arimo-400.ttf', 400, 'normal'),
        ('Arimo-600.ttf', 600, 'normal'),
        ('Arimo-700.ttf', 700, 'normal'),
        ('Arimo-400-italic.ttf', 400, 'italic'),
      ])
        "@font-face{font-family:'Arimo';font-style:$style;font-weight:$weight;"
            "src:url(data:font/ttf;base64,${base64Encode((await rootBundle.load('assets/agenda/$file')).buffer.asUint8List())}) format('truetype');}",
    ].join();
    _logo ??= 'data:image/png;base64,${base64Encode((await rootBundle.load('assets/agenda/tm.png')).buffer.asUint8List())}';
    return SheetAssets(fontFaces: _fonts!, logo: _logo!, bannerImage: await _fetchImage(bannerImageUrl));
  }

  static Future<String?> _fetchImage(String? url) async {
    if (url == null || url.isEmpty) return null;
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 10);
    try {
      final res = await (await client.getUrl(Uri.parse(url))).close().timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return null;
      final bytes = await consolidateHttpClientResponseBytes(res);
      final type = res.headers.contentType?.mimeType ?? 'image/jpeg';
      return 'data:$type;base64,${base64Encode(bytes)}';
    } catch (_) {
      return null; // The strip falls back to the banner colour, as on the web while the file loads.
    } finally {
      client.close();
    }
  }
}

String _e(String s) => const HtmlEscape(HtmlEscapeMode.element).convert(s);

String _num(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// The agenda sheet as a standalone HTML page.
///
/// [scale] below 1 lays the sheet out wider and shrinks it by the same factor
/// so it still fills one A4 page (the web's `A4Page` fit). [measure] drops the
/// fixed page height so the content's natural height can be read off.
String agendaSheetHtml(AgendaData a, List<SheetRow> rows, SheetAssets assets, {double scale = 1, bool measure = false}) {
  final theme = a.theme;
  final themeLine = theme.trim();
  final banner = StringBuffer('background-color:${_e(a.bannerColorCss?.trim().isNotEmpty == true ? a.bannerColorCss!.trim() : _defaultBannerColor)};');
  if (assets.bannerImage != null) {
    final pos = a.bannerImagePos ?? (x: 50.0, y: 50.0, zoom: 1.0, aspect: null);
    final zoom = pos.zoom < 1 ? 1.0 : pos.zoom;
    const stripAspect = 794 / 96;
    final size = pos.aspect == null
        ? 'cover'
        : pos.aspect! >= stripAspect
            ? 'auto ${_num(zoom * 100)}%'
            : '${_num(zoom * 100)}% auto';
    banner.write('background-image:url("${assets.bannerImage}");background-size:$size;'
        'background-position:${_num(pos.x)}% ${_num(pos.y)}%;background-repeat:no-repeat;');
  }

  final out = StringBuffer()
    ..write('<!doctype html><html><head><meta charset="utf-8">')
    ..write('<meta name="viewport" content="width=device-width, initial-scale=1">')
    ..write('<style>${assets.fontFaces}')
    // Tailwind's preflight, which the web sheet renders under.
    ..write('*,::after,::before{box-sizing:border-box;margin:0;padding:0;border:0 solid}')
    ..write('html{line-height:1.5;-webkit-text-size-adjust:100%;tab-size:4}')
    ..write('b,strong{font-weight:bolder}')
    ..write('table{text-indent:0;border-color:inherit;border-collapse:collapse}')
    ..write('img{display:block;vertical-align:middle;max-width:100%;height:auto}')
    // print.css
    ..write('.agenda-a4,.agenda-a4 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}')
    ..write(measure
        ? '@page{size:${_num(_a4WidthMm)}mm ${_num(_a4HeightMm * 6)}mm;margin:0}html,body{margin:0;background:#fff;width:210mm}'
        : '@page{size:A4 portrait;margin:0}html,body{width:210mm;height:297mm;margin:0;padding:0;overflow:hidden;background:#fff}')
    ..write('</style></head><body>')
    ..write(measure
        ? '<div class="agenda-a4" style="position:relative;width:210mm;background:white">'
        : '<div class="agenda-a4" style="position:relative;width:210mm;height:297mm;overflow:hidden;background:white">')
    ..write('<div style="${measure ? 'position:relative' : 'position:absolute;top:0;left:0'};'
        'width:${_num(_a4WidthMm / scale)}mm;min-height:${measure ? '0' : '${_num(_a4HeightMm / scale)}mm'};'
        '${scale < 1 ? 'transform:scale(${_num(scale)});' : ''}transform-origin:0 0;display:flex;flex-direction:column;'
        "font-family:'Arimo', Arial, Helvetica, sans-serif;color:#111827;-webkit-text-size-adjust:100%;text-size-adjust:100%\">");

  // ── Header: banner strip + info bar ──
  out
    ..write('<div style="${banner}position:relative;overflow:hidden;height:96px;display:flex;align-items:center">')
    ..write('<div style="position:relative;z-index:1;flex-shrink:0;width:108px;height:96px;display:flex;align-items:center;justify-content:center;padding-left:20px">')
    ..write('<img alt="Toastmasters logo" width="76" height="76" src="${assets.logo}" style="width:76px;height:76px;object-fit:contain"></div>')
    ..write('<div style="flex:1 1 0%;text-align:right;padding-right:20px;position:relative;z-index:1">')
    ..write('<div style="font-size:20px;font-weight:bold;color:white;letter-spacing:0.5px">${_e(a.clubName)}</div>');
  if (themeLine.isNotEmpty) {
    out.write('<div style="font-size:11px;color:rgba(255, 255, 255, 0.8);letter-spacing:1px;margin-top:2px">${_e(themeLine)}</div>');
  }
  out
    ..write('</div></div>')
    ..write('<div style="padding:5px 16px;border-bottom:2px solid $_rule;display:flex;flex-wrap:wrap;gap:28px;font-size:11px;align-items:center">')
    ..write('<span style="font-weight:bold">${sheetDate(a.dateTime)}</span>')
    ..write('<span>Meeting # <strong>${a.meetingNumber}</strong></span>')
    ..write('<span>Theme of the day: &nbsp;<strong>${_e(theme)}</strong></span></div>');

  // ── Body: rail + run-of-show ──
  out.write('<div style="flex:1 0 auto;display:flex">');
  _rail(out, a);
  _table(out, rows);
  out.write('</div></div></div></body></html>');
  return out.toString();
}

void _section(StringBuffer out, String title, String body, {String accent = _rule, int gap = 11}) {
  out
    ..write('<div style="margin-bottom:${gap}px">')
    ..write('<div style="font-size:10px;font-weight:bold;color:$accent;border-bottom:1px solid $accent;padding-bottom:2px;margin-bottom:4px">${_e(title)}</div>')
    ..write(body)
    ..write('</div>');
}

String _railName(String text) => '<div style="font-size:9.5px;font-style:italic;color:#1f2937;line-height:1.4">${_e(text)}</div>';

void _rail(StringBuffer out, AgendaData a) {
  out
    ..write('<div style="width:148px;flex-shrink:0;border-right:1px solid #d1d5db;padding:10px">')
    ..write('<div style="font-size:11px;font-weight:bold;color:#111827;margin-bottom:11px">${railDate(a.dateTime)}</div>');

  for (final o in officerPrintOrder) {
    final holders = a.officers?[o.role] ?? const <String>[];
    _section(
      out,
      o.label,
      holders.isEmpty
          ? '<div style="font-size:9.5px;color:#1f2937;line-height:1.4">—</div>'
          : holders.map((n) => '<div style="font-size:9.5px;color:#1f2937;line-height:1.4">${_e(n)}</div>').join(),
      accent: _defaultBannerColor,
    );
  }

  final evaluators = <String>[];
  for (final s in a.speakers) {
    if (s.evaluatorName.isNotEmpty && !evaluators.contains(s.evaluatorName)) evaluators.add(s.evaluatorName);
  }
  _section(out, 'Prepared Speech Evaluators', evaluators.isEmpty ? _railName('—') : evaluators.map(_railName).join());

  _section(
    out,
    'Prepared Speakers',
    a.speakers.isEmpty
        ? _railName('—')
        : [
            for (var i = 0; i < a.speakers.length; i++)
              '<div style="font-size:9.5px;margin-bottom:3px;font-style:italic">${i + 1}.&nbsp;'
                  '${_e(a.speakers[i].speakerName.isEmpty ? 'To be confirmed' : a.speakers[i].speakerName)}</div>',
          ].join(),
  );

  _section(out, 'Mission of the Club', '<div style="font-size:8.5px;line-height:1.65;color:#374151">${_e(clubMission)}</div>', gap: 12);

  final w = a.word;
  final word = StringBuffer('<div style="font-size:11px;font-weight:bold;margin-bottom:2px">${_e(w.word.isEmpty ? '—' : w.word)}</div>');
  if (w.partOfSpeech.isNotEmpty) {
    word.write('<div style="font-size:9px;font-style:italic;color:#4b5563;margin-bottom:3px">(${_e(w.partOfSpeech)})</div>');
  }
  if (w.meaning.isNotEmpty) {
    word.write('<div style="font-size:9px;line-height:1.5;margin-bottom:4px"><strong>Meaning:&nbsp;</strong>${_e(w.meaning)}</div>');
  }
  if (w.example.isNotEmpty) {
    word.write('<div style="font-size:9px;line-height:1.5;font-style:italic;color:#374151">“${_e(w.example)}”</div>');
  }
  _section(out, 'Word of the Day', word.toString(), gap: 0);
  out.write('</div>');
}

void _table(StringBuffer out, List<SheetRow> rows) {
  const head = 'font-size:11px;text-align:left;padding-bottom:5px;color:$_rule';
  const block = 'padding:7px 8px 7px 0;font-size:13px;font-weight:bold;vertical-align:top';
  const line = 'padding:3px 8px 3px 0;font-size:12px;vertical-align:top';
  out
    ..write('<div style="flex:1 1 0%;padding:10px 12px 12px">')
    ..write('<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid $_rule">')
    ..write('<th style="$head;width:68px">Time</th>')
    ..write('<th style="$head">Description</th>')
    ..write('<th style="$head;width:30%">Person</th>')
    ..write('<th style="$head;width:32px;text-align:center">Min</th>')
    ..write('</tr></thead><tbody>');
  for (final r in rows) {
    out
      ..write('<tr style="border-top:1px solid $_rule">')
      ..write('<td style="$block;color:$_rule;white-space:nowrap;width:68px">${BdTime.time(r.startsAt)}</td>')
      ..write('<td style="$block">${_e(r.title)}</td>')
      ..write('<td style="$block;font-weight:600;width:30%">${_e(r.person ?? '')}</td>')
      ..write('<td style="$block;font-weight:normal;text-align:center;width:32px">${r.displayMinutes ?? ''}</td>')
      ..write('</tr>');
    for (final l in r.lines) {
      out
        ..write('<tr><td style="padding:1px 0"></td>')
        ..write('<td style="padding:3px 8px 3px 0;font-size:${l.meta ? 11 : 12}px;vertical-align:top;padding-left:18px;'
            'font-style:${l.meta ? 'italic' : 'normal'};color:${l.meta ? '#6b7280' : '#1f2937'}">${_e(l.label)}</td>')
        ..write('<td style="$line;font-weight:600">${_e(l.person ?? '')}</td>')
        ..write('<td style="$line;text-align:center">${l.minutes ?? ''}</td>')
        ..write('</tr>');
    }
  }
  out.write('</tbody></table></div>');
}

final _a4 = PdfPageFormat(_a4WidthMm * PdfPageFormat.mm, _a4HeightMm * PdfPageFormat.mm);

/// Renders the sheet to a one-page A4 PDF through the platform web engine.
///
/// Android's print WebView runs no JavaScript, so the web's measure-and-fit
/// step happens here: when the sheet overflows A4, lay it out on a tall page,
/// read the content's height off a low-resolution raster, and render again
/// scaled by `room / natural` (floored to 3 places, as on the web).
Future<Uint8List> renderAgendaSheetPdf(AgendaData a, ProjectLookup find) async {
  final assets = await SheetAssets.load(bannerImageUrl: a.bannerImageUrl);
  final rows = buildSheetRows(a, find);

  Future<Uint8List> render(double scale) =>
      // ignore: deprecated_member_use — still the platform engine's HTML→PDF; the sheet is HTML on the web too.
      Printing.convertHtml(format: _a4, html: agendaSheetHtml(a, rows, assets, scale: scale));

  var pdf = await render(1);
  if (await _pageCount(pdf) <= 1) return pdf;

  final naturalMm = await _contentHeightMm(a, rows, assets);
  var scale = naturalMm == null ? 0.9 : (_a4HeightMm / naturalMm * 1000).floorToDouble() / 1000;
  for (var attempt = 0; attempt < 4; attempt++) {
    pdf = await render(scale);
    if (await _pageCount(pdf) <= 1) return pdf;
    scale = (scale * 0.97 * 1000).floorToDouble() / 1000;
  }
  return pdf;
}

Future<int> _pageCount(Uint8List pdf) async {
  var n = 0;
  await for (final _ in Printing.raster(pdf, dpi: 4)) {
    n++;
  }
  return n;
}

/// The sheet's natural height at A4 width: render it on one tall page and find
/// the lowest non-white pixel row (the rail's rule runs to the content foot).
Future<double?> _contentHeightMm(AgendaData a, List<SheetRow> rows, SheetAssets assets) async {
  const dpi = 96.0;
  final tall = PdfPageFormat(_a4.width, _a4.height * 6);
  try {
    // ignore: deprecated_member_use
    final pdf = await Printing.convertHtml(format: tall, html: agendaSheetHtml(a, rows, assets, measure: true));
    final page = await Printing.raster(pdf, pages: const [0], dpi: dpi).first;
    final px = page.pixels;
    for (var y = page.height - 1; y >= 0; y--) {
      final rowStart = y * page.width * 4;
      for (var x = 0; x < page.width; x++) {
        final i = rowStart + x * 4;
        if (px[i] < 245 || px[i + 1] < 245 || px[i + 2] < 245) return (y + 1) / dpi * 25.4;
      }
    }
  } catch (_) {
    // Fall through to the stepwise fit.
  }
  return null;
}
