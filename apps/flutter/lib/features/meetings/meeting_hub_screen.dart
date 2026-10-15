import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../ui/widgets.dart';
import 'attendance_screen.dart' show attendanceMembersProvider;
import 'meeting_common.dart';

class _HubCard {
  const _HubCard(this.route, this.label, this.icon, this.progress, {this.live = false});
  final String route;
  final String label;
  final IconData icon;
  final double? progress;
  final bool live;
}

/// Meeting detail — a grid of cards, each pushing its own page (PRD §7.2).
class MeetingHubScreen extends ConsumerWidget {
  const MeetingHubScreen({super.key, required this.meetingId});
  final String meetingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final can = ref.watch(canProvider);
    if (!can(Act.read, 'meeting')) return const AccessRestricted(title: 'Meeting');
    final meeting = ref.watch(meetingProvider(meetingId));

    return meeting.when(
      loading: () => Scaffold(appBar: AppBar(title: const Text('Meeting')), body: const SkeletonList(count: 4, height: 100)),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Meeting')),
        body: ErrorState(
          error: e,
          title: 'Could not load this meeting',
          onRetry: () => ref.invalidate(meetingProvider(meetingId)),
        ),
      ),
      data: (m) => _Hub(meeting: m),
    );
  }
}

class _Hub extends ConsumerWidget {
  const _Hub({required this.meeting});
  final Meeting meeting;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final id = meeting.id;
    final roles = ref.watch(meetingRolesProvider(id)).value;
    final speakers = ref.watch(speakersProvider(id)).value;
    final topics = ref.watch(tableTopicsProvider(id)).value;

    final themeParts = [meeting.theme, meeting.word.word, meeting.word.meaning];
    final themeRatio = themeParts.where((p) => p.trim().isNotEmpty).length / themeParts.length;
    final required = buildRoles(meeting).where((r) => !r.optional).toList();
    final rolesRatio = roles == null
        ? null
        : required.where((r) => roles.any((a) => a.roleKey == r.key && a.filled)).length / required.length;
    final speakersRatio = speakers == null ? null : (speakers.length.clamp(0, targetSpeakers) / targetSpeakers);
    final setup = [themeRatio, ?rolesRatio, ?speakersRatio];
    final overview = setup.reduce((a, b) => a + b) / setup.length;
    final present = ref.watch(attendanceMembersProvider(id)).value;
    final roster = ref.watch(membersProvider).value?.where((m) => m.isActive).length;
    final attendanceRatio = present == null || roster == null || roster == 0
        ? null
        : present.values.where((v) => v).length / roster;
    final topicsRatio =
        topics == null || topics.isEmpty ? null : topics.where((t) => t.asked).length / topics.length;

    final cards = [
      _HubCard('overview', 'Overview', PhosphorIconsRegular.info, overview),
      _HubCard('roles', 'Roles', PhosphorIconsRegular.usersThree, rolesRatio),
      _HubCard('speakers', 'Prepared Speakers', PhosphorIconsRegular.microphoneStage, speakersRatio),
      _HubCard('theme', 'Theme', PhosphorIconsRegular.palette, themeRatio),
      _HubCard('table-topics', 'Table Topics', PhosphorIconsRegular.lightbulb, topicsRatio),
      _HubCard('agenda', 'Agenda', PhosphorIconsRegular.listBullets, null),
      const _HubCard('timer', 'Timer', PhosphorIconsRegular.timer, null, live: true),
      const _HubCard('ah-counter', 'Ah Counter', PhosphorIconsRegular.speakerHigh, null, live: true),
      const _HubCard('grammarian', 'Grammarian', PhosphorIconsRegular.textAa, null, live: true),
      _HubCard('attendance', 'Attendance', PhosphorIconsRegular.clipboardText, attendanceRatio),
      const _HubCard('voting', 'Voting', PhosphorIconsRegular.chartBar, null, live: true),
    ];

    return Scaffold(
      appBar: AppBar(
        title: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => _switchMeeting(context, ref),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text('Meeting #${meeting.meetingNumber}'),
              const SizedBox(width: 4),
              Icon(PhosphorIconsRegular.caretDown, size: 16, color: c.inkSoft),
            ]),
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Share caption',
            icon: const Icon(PhosphorIconsRegular.shareNetwork),
            onPressed: () => shareCaption(context, ref, meeting),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(meetingRolesProvider(meeting.id));
          ref.invalidate(speakersProvider(meeting.id));
          ref.invalidate(tableTopicsProvider(meeting.id));
          ref.invalidate(meetingProvider(meeting.id));
          await ref.read(meetingProvider(meeting.id).future);
        },
        child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(meeting.displayTheme, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 4),
              Text(BdTime.meeting(meeting.dateTime), style: Theme.of(context).textTheme.bodySmall),
            ]),
          ),
          const SizedBox(height: 12),
          _StatusBar(meeting: meeting),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.45,
              children: [
                for (final card in cards)
                  _HubTile(card: card, onTap: () => context.push('/meetings/${meeting.id}/${card.route}')),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Future<void> _switchMeeting(BuildContext context, WidgetRef ref) async {
    final list = await ref.read(meetingsProvider.future);
    if (!context.mounted) return;
    final sorted = [...list]..sort((a, b) => b.dateTime.compareTo(a.dateTime));
    final picked = await showModalBottomSheet<Meeting>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (ctx, scroll) => Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Align(alignment: Alignment.centerLeft, child: Text('Switch meeting', style: Theme.of(ctx).textTheme.titleLarge)),
          ),
          Expanded(
            child: ListView(controller: scroll, children: [
              for (final m in sorted)
                RowTile(
                  title: '#${m.meetingNumber} · ${m.displayTheme}',
                  subtitle: BdTime.meeting(m.dateTime),
                  trailing: m.id == meeting.id
                      ? Icon(PhosphorIconsFill.checkCircle, color: AppColors.of(ctx).success)
                      : (m.isPublished ? null : const Pill('Draft')),
                  onTap: () => Navigator.pop(ctx, m),
                ),
            ]),
          ),
        ]),
      ),
    );
    if (picked != null && picked.id != meeting.id && context.mounted) {
      context.pushReplacement('/meetings/${picked.id}');
    }
  }
}

class _HubTile extends StatelessWidget {
  const _HubTile({required this.card, required this.onTap});
  final _HubCard card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Semantics(
      button: true,
      label: card.progress == null ? card.label : '${card.label}, ${(card.progress! * 100).round()} percent',
      child: Material(
        color: c.canvas,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: c.line)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (card.live) Pill('LIVE', color: c.inkSoft),
                const Spacer(),
                ProgressRing(icon: card.icon, value: card.progress, size: 38),
              ]),
              const Spacer(),
              Text(card.label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.ink)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Draft/Published bar with exactly one primary action; the rest go in a
/// bottom sheet.
class _StatusBar extends ConsumerStatefulWidget {
  const _StatusBar({required this.meeting});
  final Meeting meeting;
  @override
  ConsumerState<_StatusBar> createState() => _StatusBarState();
}

class _StatusBarState extends ConsumerState<_StatusBar> {
  bool _busy = false;

  Future<void> _setStatus(String status) async {
    final m = widget.meeting;
    if (status == 'published') {
      final ok = await confirmDialog(
        context,
        title: 'Publish meeting #${m.meetingNumber}?',
        message: 'The whole club will see the agenda, and everyone on it gets a WhatsApp message.',
        confirmLabel: 'Publish',
      );
      if (!ok) return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).updateMeeting(m.id, {'status': status});
      ref.invalidate(meetingProvider(m.id));
      ref.invalidate(meetingsProvider);
      HapticFeedback.mediumImpact();
      if (mounted) showToast(context, status == 'published' ? 'Meeting published' : 'Saved as draft');
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final m = widget.meeting;
    final ok = await confirmDialog(
      context,
      title: 'Delete meeting #${m.meetingNumber}?',
      message: 'This removes the meeting and all its records. It cannot be undone.',
      confirmLabel: 'Delete meeting',
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(apiProvider).deleteMeeting(m.id);
      ref.invalidate(meetingsProvider);
      if (!mounted) return;
      showToast(context, 'Meeting #${m.meetingNumber} was deleted');
      context.pop();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final can = ref.watch(canProvider);
    final canWrite = can(Act.update, 'meeting');
    final canDelete = can(Act.delete, 'meeting');
    final m = widget.meeting;

    return AppCard(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      child: Row(children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(color: m.isPublished ? c.ink : c.fill, borderRadius: BorderRadius.circular(9)),
          child: Icon(m.isPublished ? PhosphorIconsBold.check : PhosphorIconsBold.penNib,
              size: 16, color: m.isPublished ? c.canvas : c.inkSoft),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(m.isPublished ? 'Published' : 'Draft',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: c.ink)),
        ),
        if (m.isPublished)
          OutlinedButton.icon(
            onPressed: () => shareText(context, MeetingLinks.agenda(m)),
            icon: const Icon(PhosphorIconsRegular.link, size: 16),
            label: const Text('Share link'),
          )
        else
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 42), padding: const EdgeInsets.symmetric(horizontal: 16)),
            onPressed: canWrite && !_busy ? () => _setStatus('published') : null,
            icon: _busy
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(PhosphorIconsRegular.paperPlaneTilt, size: 16),
            label: const Text('Publish'),
          ),
        if (canWrite || canDelete)
          IconButton(
            tooltip: 'More meeting actions',
            icon: const Icon(PhosphorIconsBold.dotsThreeVertical),
            onPressed: () => showActionSheet(context, actions: [
              if (canWrite && m.isPublished)
                SheetAction(
                  icon: PhosphorIconsRegular.penNib,
                  label: 'Save as draft',
                  subtitle: 'Unpublish — only the committee sees it',
                  onTap: () => _setStatus('draft'),
                ),
              SheetAction(
                icon: PhosphorIconsRegular.link,
                label: 'Copy public agenda link',
                onTap: () => copyText(context, MeetingLinks.agenda(m), 'Public agenda link copied'),
              ),
              if (canDelete)
                SheetAction(
                  icon: PhosphorIconsRegular.trash,
                  label: 'Delete meeting',
                  subtitle: 'Removes the meeting and all its records',
                  destructive: true,
                  onTap: _delete,
                ),
            ]),
          ),
      ]),
    );
  }
}
