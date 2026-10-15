import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../ui/widgets.dart';

import 'agenda_pdf_screen.dart';
import 'agenda_sheet.dart' show officerPrintOrder;
import 'meeting_common.dart';

/// Normalised agenda — built from the public endpoint (deep links, signed
/// out) or composed from the club's own data (works for drafts too).
class AgendaData {
  AgendaData({
    required this.meetingId,
    required this.meetingNumber,
    required this.dateTime,
    required this.theme,
    required this.clubName,
    required this.roles,
    required this.speakers,
    required this.word,
    required this.topics,
    this.contactPhone,
    this.mapUrl,
    this.bannerColor,
    this.bannerColorCss,
    this.bannerImageUrl,
    this.bannerImagePos,
    this.officers,
    this.isPublished = true,
  });
  final String meetingId;
  final int meetingNumber;
  final DateTime dateTime;
  final String theme;
  final String clubName;
  final List<({String roleKey, String name})> roles;
  final List<AgendaSpeaker> speakers;
  final WordOfTheDay word;
  final List<TableTopic> topics;
  final String? contactPhone;
  final String? mapUrl;
  final Color? bannerColor;

  /// The club's banner colour exactly as stored (the printed sheet uses it
  /// verbatim, like the web).
  final String? bannerColorCss;
  final String? bannerImageUrl;
  final ({double x, double y, double zoom, double? aspect})? bannerImagePos;

  /// Active roster members by officer role (`President`, `VPE`, …) for the
  /// printed sheet's rail. Null when the roster isn't readable (signed out).
  final Map<String, List<String>>? officers;
  final bool isPublished;
}

final _clubAgendaProvider = FutureProvider.family<AgendaData, String>((ref, id) async {
  final m = await ref.watch(meetingProvider(id).future);
  final roles = await ref.watch(meetingRolesProvider(id).future);
  final speakers = await ref.watch(speakersProvider(id).future);
  final people = await ref.watch(peopleProvider.future);
  final members = await ref.watch(membersProvider.future).catchError((_) => <Member>[]);
  final club = await ref.watch(clubProvider.future).catchError((_) => Club(id: '', name: ''));
  final topics = await ref.watch(tableTopicsProvider(id).future).catchError((_) => <TableTopic>[]);
  return AgendaData(
    meetingId: m.id,
    meetingNumber: m.meetingNumber,
    dateTime: m.dateTime,
    theme: m.theme,
    clubName: club.name,
    contactPhone: club.contactPhone,
    mapUrl: club.venueMapUrl,
    bannerColor: parseHexColor(club.bannerColor),
    bannerColorCss: club.bannerColor,
    bannerImageUrl: club.bannerImageUrl,
    bannerImagePos: club.bannerImagePos,
    officers: {
      for (final o in officerPrintOrder)
        o.role: [
          for (final mem in members)
            if (mem.status == 'active' && mem.roles.contains(o.role)) mem.name,
        ],
    },
    isPublished: m.isPublished,
    roles: [
      for (final r in roles)
        if (r.filled) (roleKey: r.roleKey, name: people.name(membershipId: r.membershipId, guestId: r.guestId) ?? ''),
    ],
    speakers: [
      for (final s in speakers)
        AgendaSpeaker(
          order: s.order,
          kind: s.kind,
          title: s.title,
          speakerName: people.name(membershipId: s.membershipId, guestId: s.guestId) ?? '',
          evaluatorName: people.name(membershipId: s.evaluatorMembershipId, guestId: s.evaluatorGuestId) ?? '',
          duration: s.duration,
          pathway: s.pathway,
          project: s.project,
        ),
    ],
    word: m.word,
    topics: topics,
  );
});

final _publicAgendaDataProvider = FutureProvider.family<AgendaData, String>((ref, id) async {
  final a = await ref.watch(publicAgendaProvider(id).future);
  return AgendaData(
    meetingId: a.id,
    meetingNumber: a.meetingNumber,
    dateTime: a.dateTime,
    theme: a.theme,
    clubName: a.clubName,
    contactPhone: a.clubContactPhone,
    mapUrl: a.clubVenueMapUrl,
    roles: a.roles,
    speakers: a.speakers..sort((x, y) => x.order.compareTo(y.order)),
    word: a.word,
    topics: const [],
  );
});

void openAgendaPdf(BuildContext context, AgendaData data) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => AgendaPdfScreen(data: data)));

class AgendaScreen extends ConsumerWidget {
  const AgendaScreen({super.key, required this.meetingId, this.standalone = false});
  final String meetingId;

  /// Opened from a shared link — may be signed out, uses the public endpoint.
  final bool standalone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inClub = !standalone && ref.watch(signedInProvider)?.clubId != null;
    final provider = inClub ? _clubAgendaProvider(meetingId) : _publicAgendaDataProvider(meetingId);
    final data = ref.watch(provider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Agenda'),
        leading: standalone && !context.canPop()
            ? IconButton(icon: const Icon(Icons.close), onPressed: () => context.go('/'))
            : null,
        actions: [
          if (data.hasValue)
            IconButton(
              tooltip: 'View PDF',
              icon: const Icon(PhosphorIconsRegular.filePdf),
              onPressed: () => openAgendaPdf(context, data.requireValue),
            ),
          IconButton(
            tooltip: 'Share',
            icon: const Icon(PhosphorIconsRegular.shareNetwork),
            onPressed: () => showActionSheet(context, actions: [
              SheetAction(
                icon: PhosphorIconsRegular.link,
                label: 'Share agenda link',
                onTap: () => shareText(context, MeetingLinks.agendaFor(meetingId)),
              ),
              if (data.hasValue)
                SheetAction(
                  icon: PhosphorIconsRegular.filePdf,
                  label: 'View & download PDF',
                  subtitle: 'Preview, save to your phone, share or print',
                  onTap: () => openAgendaPdf(context, data.requireValue),
                ),
            ]),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(provider.future),
        child: data.when(
          loading: () => const SkeletonList(count: 5, height: 90),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 40),
            EmptyState(
              icon: PhosphorIconsRegular.fileX,
              title: 'This agenda isn’t available',
              message: 'It may not be published yet, or the link may be out of date. Please check with the meeting organiser.',
              action: OutlinedButton(onPressed: () => ref.invalidate(provider), child: const Text('Try again')),
            ),
          ]),
          data: (a) => _AgendaView(data: a),
        ),
      ),
    );
  }
}

class _AgendaView extends StatelessWidget {
  const _AgendaView({required this.data});
  final AgendaData data;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final a = data;
    final byKey = {for (final r in a.roles) r.roleKey: r.name};
    const mentorKeys = ['toastmaster', 'general-evaluator', 'table-topic-master'];
    final mentors = [for (final k in mentorKeys) if (byKey[k] != null && byKey[k]!.isNotEmpty) (k, byKey[k]!)];
    final others = [
      for (final r in a.roles)
        if (!mentorKeys.contains(r.roleKey) && r.name.isNotEmpty) (r.roleKey, r.name),
    ];

    return ListView(padding: const EdgeInsets.only(bottom: 40), children: [
      Container(
        margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: a.bannerColor,
          gradient: a.bannerColor == null ? LinearGradient(colors: [c.heroStart, c.heroEnd]) : null,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(a.clubName.toUpperCase(),
                  style: t.labelSmall?.copyWith(color: Colors.white70, letterSpacing: 1.4)),
            ),
            if (!a.isPublished) Pill('DRAFT', color: c.warning, background: const Color(0xFFFFF4CC)),
          ]),
          const SizedBox(height: 10),
          Text('Meeting #${a.meetingNumber}', style: const TextStyle(color: Colors.white70, fontSize: 14)),
          Text(a.theme.isEmpty ? 'Theme to be announced' : a.theme,
              style: t.headlineMedium?.copyWith(color: Colors.white)),
          const SizedBox(height: 8),
          Text(BdTime.meeting(a.dateTime), style: const TextStyle(color: Colors.white, fontSize: 14.5)),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: OutlinedButton.icon(
          onPressed: () => openAgendaPdf(context, a),
          icon: const Icon(PhosphorIconsRegular.filePdf, size: 18),
          label: const Text('View & download PDF'),
        ),
      ),
      if (a.contactPhone != null || a.mapUrl != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(children: [
            if (a.contactPhone != null)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => launchUrl(Uri.parse('tel:${a.contactPhone}')),
                  icon: const Icon(PhosphorIconsRegular.phone, size: 18),
                  label: const Text('Contact club'),
                ),
              ),
            if (a.contactPhone != null && a.mapUrl != null) const SizedBox(width: 10),
            if (a.mapUrl != null)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => launchUrl(Uri.parse(a.mapUrl!), mode: LaunchMode.externalApplication),
                  icon: const Icon(PhosphorIconsRegular.mapPin, size: 18),
                  label: const Text('View location'),
                ),
              ),
          ]),
        ),
      if (mentors.isNotEmpty) ...[
        const SectionLabel('Meet the mentors'),
        GroupCard(children: [
          for (final m in mentors)
            RowTile(
              leading: Avatar(name: m.$2, size: 36),
              title: m.$2,
              subtitle: roleKeyLabel(m.$1, start: a.dateTime),
            ),
        ]),
      ],
      if (!a.word.isEmpty) ...[
        const SectionLabel('Word of the day'),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(a.word.word, style: t.headlineMedium),
              if (a.word.partOfSpeech.isNotEmpty) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(a.word.partOfSpeech, style: t.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
                ),
              ],
            ]),
            if (a.word.meaning.isNotEmpty) ...[const SizedBox(height: 6), Text(a.word.meaning, style: t.bodyMedium)],
            if (a.word.example.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('“${a.word.example}”', style: t.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
            ],
          ]),
        ),
      ],
      const SectionLabel('Prepared speeches'),
      if (a.speakers.isEmpty)
        AppCard(child: Text('Speakers to be announced.', style: t.bodySmall))
      else
        for (final s in a.speakers)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(s.kind == 'keynote' ? 'KEYNOTE' : 'SPEECH ${s.order}', style: t.labelSmall),
                  const Spacer(),
                  if (s.duration != null) Pill('${s.duration} min', icon: PhosphorIconsRegular.timer),
                ]),
                const SizedBox(height: 6),
                Text(s.title.isEmpty ? 'Untitled speech' : s.title, style: t.titleMedium),
                const SizedBox(height: 2),
                Text(s.speakerName.isEmpty ? 'To be confirmed' : s.speakerName, style: t.bodyMedium?.copyWith(color: c.inkSoft)),
                if (s.pathway != null || s.project != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text([s.pathway, s.project].whereType<String>().join(' · '), style: t.bodySmall),
                  ),
                if (s.kind != 'keynote' && s.evaluatorName.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('Evaluator: ${s.evaluatorName}', style: t.bodySmall?.copyWith(color: c.inkSoft)),
                ],
              ]),
            ),
          ),
      if (others.isNotEmpty) ...[
        const SectionLabel('Other roles'),
        GroupCard(children: [
          for (final r in others)
            RowTile(dense: true, title: roleKeyLabel(r.$1, start: a.dateTime), trailing: Text(r.$2)),
        ]),
      ],
      if (a.topics.isNotEmpty) ...[
        const SectionLabel('Table topics'),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (var i = 0; i < a.topics.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Text('${i + 1}. ${a.topics[i].text}',
                    style: TextStyle(color: a.topics[i].asked ? c.inkMuted : c.ink, fontSize: 14.5, height: 1.4)),
              ),
          ]),
        ),
      ],
    ]);
  }
}
