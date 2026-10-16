import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../domain/my_roles.dart';
import '../../domain/pathways.dart';
import '../../ui/widgets.dart';
import '../me/context_switcher.dart';
import '../meetings/meetings_screen.dart' show showNewMeetingSheet;
import '../org/org_home_screen.dart';

/// Ticks every second — drives countdowns.
final nowProvider = StreamProvider<DateTime>((ref) async* {
  yield DateTime.now().toUtc();
  yield* Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now().toUtc());
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(meetingsProvider);
    ref.invalidate(membersProvider);
    ref.invalidate(guestsProvider);
    await ref.read(meetingsProvider.future).catchError((_) => <Meeting>[]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(signedInProvider);
    final t = Theme.of(context).textTheme;
    final c = AppColors.of(context);
    if (s == null) return const SizedBox.shrink();
    final ctx = s.context;

    if (ctx == null || ctx.kind != ContextKind.club) return const OrgHomeScreen();

    final meetings = ref.watch(meetingsProvider);
    final me = s.membership?.membershipId;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: CustomScrollView(slivers: [
          SliverSafeArea(
            bottom: false,
            sliver: SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 4),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Hi, ${s.session.user.firstName}', style: t.headlineLarge),
                      const SizedBox(height: 4),
                      Text(
                        BdTime.todayHeader(DateTime.now()),
                        style: t.bodyMedium?.copyWith(color: c.inkSoft),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ]),
                  ),
                  const SizedBox(width: Space.md),
                  const ContextChip(),
                ]),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: meetings.when(
              data: (list) => _NextMeetingSection(meetings: list, membershipId: me),
              loading: () => const SkeletonBox(height: 230, margin: EdgeInsets.fromLTRB(16, 16, 16, 0)),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(meetingsProvider)),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ]),
      ),
    );
  }
}

// ───────────────────────── Next meeting + lineup ─────────────────────────

class _NextMeetingSection extends ConsumerWidget {
  const _NextMeetingSection({required this.meetings, required this.membershipId});
  final List<Meeting> meetings;
  final String? membershipId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now().toUtc();
    // Drafts count too — any member can edit agendas, and the hero flags them.
    final next = MeetingPartition.of(meetings, now).current;
    if (next == null) {
      final canCreate = ref.watch(canProvider)(Act.create, 'meeting');
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: EmptyState(
          icon: PhosphorIconsRegular.calendarBlank,
          title: 'No meeting on the calendar',
          message: canCreate
              ? 'Schedule the next meeting and its countdown and lineup will show up here.'
              : 'Once the next meeting is scheduled, its countdown and lineup will show up here.',
          action: canCreate
              ? FilledButton.icon(
                  onPressed: () => showNewMeetingSheet(context, ref),
                  icon: const Icon(PhosphorIconsBold.plus, size: 18),
                  label: const Text('Add meeting'),
                )
              : OutlinedButton(
                  onPressed: () => context.go('/meetings'),
                  child: const Text('See past meetings'),
                ),
        ),
      );
    }
    final roles = ref.watch(meetingRolesProvider(next.id)).value ?? const <RoleAssignment>[];
    final speakers = ref.watch(speakersProvider(next.id)).value ?? const <PreparedSpeaker>[];
    final mine = myRolesAt(next, roles, speakers, membershipId);

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 16),
      _NextMeetingHero(meeting: next, mine: mine),
      _LineupCard(meeting: next, roles: roles, membershipId: membershipId),
    ]);
  }
}

class _NextMeetingHero extends ConsumerWidget {
  const _NextMeetingHero({required this.meeting, required this.mine});
  final Meeting meeting;
  final List<MyRole> mine;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final now = ref.watch(nowProvider).value ?? DateTime.now().toUtc();
    final hasRole = mine.isNotEmpty;
    final step = myNextStep(mine);
    final live = meeting.isLive(now);
    final diff = meeting.dateTime.difference(now);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: hasRole ? Border.all(color: c.mint, width: 2.5) : null,
        ),
        child: Material(
          borderRadius: BorderRadius.circular(hasRole ? 17.5 : 20),
          clipBehavior: Clip.antiAlias,
          child: Ink(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [c.heroStart, c.heroEnd],
              ),
            ),
            child: InkWell(
              onTap: () => context.push('/meetings/${meeting.id}'),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(
                      child: Text('NEXT MEETING · #${meeting.meetingNumber}',
                          style: t.labelSmall?.copyWith(color: Colors.white70, letterSpacing: 1.6)),
                    ),
                    if (!meeting.isPublished) Pill('DRAFT', color: c.warning, background: const Color(0xFFFFF4CC)),
                  ]),
                  const SizedBox(height: 8),
                  Text(meeting.displayTheme,
                      style: t.headlineMedium?.copyWith(color: Colors.white, fontSize: 24)),
                  const SizedBox(height: 10),
                  Wrap(spacing: 16, runSpacing: 4, children: [
                    _iconText(PhosphorIconsRegular.calendarBlank, BdTime.longDate(meeting.dateTime)),
                    _iconText(PhosphorIconsRegular.clock, BdTime.time(meeting.dateTime)),
                  ]),
                  if (hasRole) ...[
                    const SizedBox(height: 14),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final r in mine.take(2)) _RoleChip(label: 'You’re ${r.label}'),
                      if (mine.length > 2) _RoleChip(label: '+${mine.length - 2}'),
                    ]),
                  ],
                  const SizedBox(height: 16),
                  if (live)
                    Pill('Happening now', icon: PhosphorIconsFill.circle, color: c.mint, background: c.mintSoft)
                  else if (!diff.isNegative)
                    _Countdown(diff: diff),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: c.ink),
                      onPressed: () => context.push('/meetings/${meeting.id}/${step.route}'),
                      icon: Text(step.label),
                      label: const Icon(PhosphorIconsRegular.arrowRight, size: 16),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _iconText(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: Colors.white70),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(color: Colors.white, fontSize: 14.5)),
      ]);
}

class _RoleChip extends StatelessWidget {
  const _RoleChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: c.mintSoft,
        shape: StadiumBorder(side: BorderSide(color: c.mint.withValues(alpha: 0.6))),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(PhosphorIconsRegular.microphoneStage, size: 16, color: c.mint),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: c.mint, fontWeight: FontWeight.w600, fontSize: 14)),
        ]),
      ),
    );
  }
}

class _Countdown extends StatelessWidget {
  const _Countdown({required this.diff});
  final Duration diff;

  @override
  Widget build(BuildContext context) {
    final parts = [
      (diff.inDays, 'DAYS'),
      (diff.inHours % 24, 'HRS'),
      (diff.inMinutes % 60, 'MIN'),
      (diff.inSeconds % 60, 'SEC'),
    ];
    return Semantics(
      label: 'Starts in ${diff.inDays} days ${diff.inHours % 24} hours ${diff.inMinutes % 60} minutes',
      child: ExcludeSemantics(
        child: Row(children: [
          for (final p in parts) ...[
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(children: [
                  Text(p.$1.toString().padLeft(2, '0'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        fontFeatures: [FontFeature.tabularFigures()],
                      )),
                  Text(p.$2,
                      style: const TextStyle(color: Colors.white60, fontSize: 10.5, letterSpacing: 1.4)),
                ]),
              ),
            ),
            if (p != parts.last) const SizedBox(width: 8),
          ],
        ]),
      ),
    );
  }
}

class _LineupCard extends ConsumerWidget {
  const _LineupCard({required this.meeting, required this.roles, required this.membershipId});
  final Meeting meeting;
  final List<RoleAssignment> roles;
  final String? membershipId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final people = ref.watch(peopleProvider).value;
    final defs = buildRoles(meeting);
    final byKey = {for (final r in roles) r.roleKey: r};
    final filled = defs.where((d) => byKey[d.key]?.filled ?? false).length;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionLabel(
        'This week’s lineup',
        trailing: GestureDetector(
          onTap: () => context.push('/meetings/${meeting.id}/agenda'),
          child: Text('Full agenda', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.ink)),
        ),
      ),
      AppCard(
        padding: EdgeInsets.zero,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text('$filled/${defs.length} roles assigned for meeting #${meeting.meetingNumber}',
                style: Theme.of(context).textTheme.bodySmall),
          ),
          for (final d in defs)
            Builder(builder: (context) {
              final a = byKey[d.key];
              final isMe = a?.membershipId != null && a?.membershipId == membershipId;
              final name = people?.name(membershipId: a?.membershipId, guestId: a?.guestId);
              return Container(
                color: isMe ? c.successSoft : null,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                child: Row(children: [
                  Expanded(child: Text(d.label, style: TextStyle(fontSize: 14, color: c.inkSoft))),
                  if (name == null)
                    Text('Open', style: TextStyle(fontSize: 14, color: c.inkMuted))
                  else
                    Text(isMe ? 'You' : name,
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isMe ? c.success : c.ink)),
                ]),
              );
            }),
          const SizedBox(height: 6),
        ]),
      ),
    ]);
  }
}

// ───────────────────────── Pathway card (shared with Me) ─────────────────────────

/// Pathway name, level, current project, and what's up next.
class PathwayProgressCard extends StatelessWidget {
  const PathwayProgressCard({super.key, required this.member, this.catalog, this.history = const [], this.onTap});
  final Member member;
  final PathwayCatalog? catalog;
  final List<HistoryEvent> history;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    if (member.pathway == null) {
      return AppCard(
        onTap: onTap,
        child: Row(children: [
          Icon(PhosphorIconsRegular.path, color: c.inkSoft),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('No pathway started yet', style: t.titleMedium),
              Text('Start your pathway to see project progress, levels, and what’s next.', style: t.bodySmall),
            ]),
          ),
        ]),
      );
    }
    final progress = catalog?.progress(
      pathway: member.pathway,
      level: member.level ?? 1,
      currentProject: member.startedProject,
      history: [for (final e in history) (type: e.type, projectName: e.projectName, pathway: e.pathway, level: e.level)],
    );
    final level = progress?.activeLevel ?? member.level ?? 1;
    return AppCard(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(member.pathway!, style: t.titleLarge),
              const SizedBox(height: 2),
              Text('Level $level of 5', style: t.bodySmall),
            ]),
          ),
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: c.ink, borderRadius: BorderRadius.circular(12)),
            child: Text('L$level', style: TextStyle(color: c.canvas, fontWeight: FontWeight.w700, fontSize: 16)),
          ),
        ]),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: level / 5,
            minHeight: 6,
            backgroundColor: c.fill,
            color: c.ink,
          ),
        ),
        if (member.startedProject != null) ...[
          const SizedBox(height: 16),
          Text('CURRENT PROJECT', style: t.labelSmall),
          const SizedBox(height: 4),
          Text(member.startedProject!, style: t.titleMedium),
          if (progress != null)
            Text(
                progress.leftInLevel == 0
                    ? 'Level $level requirements complete'
                    : '${progress.leftInLevel} ${progress.leftInLevel == 1 ? 'speech' : 'speeches'} left in Level $level',
                style: t.bodySmall),
        ],
        if (progress?.next != null) ...[
          const SizedBox(height: 14),
          Text('UP NEXT', style: t.labelSmall),
          const SizedBox(height: 4),
          Text(progress!.next!.name, style: t.bodyLarge?.copyWith(fontWeight: FontWeight.w500)),
          if (progress.next!.speechTime != null)
            Text('Level ${progress.next!.level} · ${progress.next!.speechTime!.replaceAll(' minutes', ' min')}', style: t.bodySmall),
        ],
      ]),
    );
  }
}

// ───────────────────────── Standing card (shared with Me) ─────────────────────────

/// Speeches, roles, attendance %, activity % (shared with Me).
class ClubStandingCard extends StatelessWidget {
  const ClubStandingCard({super.key, required this.stats, required this.meetings});
  final MemberStats stats;
  final List<Meeting> meetings;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final now = DateTime.now().toUtc();
    final joined = stats.joinedAt;
    final held = meetings
        .where((m) => m.isPast(now) && (joined == null || BdTime.dateKey(m.dateTime).compareTo(joined) >= 0))
        .length;
    final attendance = held == 0 ? 0.0 : (stats.meetingsAttended / held).clamp(0.0, 1.0);
    final turns = stats.speechesGiven + stats.rolesTaken;
    final activity = stats.meetingsAttended == 0 ? 0.0 : (turns / stats.meetingsAttended).clamp(0.0, 1.0);

    Widget stat(String value, String label) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: t.headlineMedium),
            Text(label, style: t.bodySmall),
          ]),
        );
    Widget bar(String label, double v, String sub) => Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(label, style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w500))),
              Text('${(v * 100).round()}%', style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: v, minHeight: 6, backgroundColor: c.fill, color: c.ink),
            ),
            const SizedBox(height: 4),
            Text(sub, style: t.bodySmall),
          ]),
        );

    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [stat('${stats.speechesGiven}', 'Speeches given'), stat('${stats.rolesTaken}', 'Roles taken')]),
        bar('Attendance', attendance, '${stats.meetingsAttended} of $held meetings since joining'),
        bar('Activity', activity, 'Share of attended meetings you spoke or took a role in'),
      ]),
    );
  }
}
