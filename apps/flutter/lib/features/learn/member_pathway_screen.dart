import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../domain/pathways.dart';
import '../../ui/widgets.dart';
import '../home/home_screen.dart' show PathwayProgressCard;

/// A member's pathway: Progress | History (PRD §10.2).
class MemberPathwayScreen extends ConsumerStatefulWidget {
  const MemberPathwayScreen({super.key, required this.memberId});
  final String memberId;
  @override
  ConsumerState<MemberPathwayScreen> createState() => _MemberPathwayScreenState();
}

class _MemberPathwayScreenState extends ConsumerState<MemberPathwayScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final member = ref.watch(memberProvider(widget.memberId));
    final can = ref.watch(canProvider);
    final canEdit = can(Act.update, 'education', ownerMembershipId: widget.memberId);
    final t = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(member.value?.name ?? 'Member'),
        actions: [
          if (canEdit && member.hasValue)
            TextButton(
              onPressed: () => showFormSheet<void>(context, builder: (_) => _UpdatePathwayForm(member: member.requireValue)),
              child: Text(member.requireValue.pathway == null ? 'Start pathway' : 'Edit'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(memberStatsProvider(widget.memberId));
          ref.invalidate(memberHistoryProvider(widget.memberId));
          ref.invalidate(memberProvider(widget.memberId));
          await ref.read(memberProvider(widget.memberId).future);
        },
        child: AsyncBody<Member>(
          value: member,
          errorTitle: 'Could not load this member',
          onRetry: () => ref.invalidate(memberProvider(widget.memberId)),
          builder: (m) => ListView(padding: const EdgeInsets.only(bottom: 40), children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Row(children: [
                Avatar(name: m.name, url: m.avatarUrl, size: 56),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m.name, style: t.titleLarge),
                    Text(m.rolesLabel, style: t.bodySmall),
                    if (m.pathway != null) Text('${m.pathway} · Level ${m.level ?? 1}', style: t.bodySmall),
                  ]),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: SizedBox(
                width: double.infinity,
                child: SegmentedButton<int>(
                  showSelectedIcon: false,
                  segments: const [ButtonSegment(value: 0, label: Text('Progress')), ButtonSegment(value: 1, label: Text('History'))],
                  selected: {_tab},
                  onSelectionChanged: (s) {
                    HapticFeedback.selectionClick();
                    setState(() => _tab = s.first);
                  },
                ),
              ),
            ),
            if (_tab == 0) _Progress(member: m) else _History(memberId: m.id),
          ]),
        ),
      ),
    );
  }
}

class _Progress extends ConsumerWidget {
  const _Progress({required this.member});
  final Member member;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Theme.of(context).textTheme;
    final stats = ref.watch(memberStatsProvider(member.id)).value;
    final catalog = ref.watch(pathwayCatalogProvider).value;
    Widget tile(String label, String value) => Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.of(context).canvas,
            border: Border.all(color: AppColors.of(context).line),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(label.toUpperCase(), style: t.labelSmall),
            const SizedBox(height: 4),
            Text(value, style: t.titleLarge),
          ]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionLabel('Current pathway'),
      PathwayProgressCard(
        member: member,
        catalog: catalog,
        history: ref.watch(memberHistoryProvider(member.id)).value ?? const <HistoryEvent>[],
      ),
      if (stats?.latestSpeech != null) ...[
        const SectionLabel('Latest speech'),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(stats!.latestSpeech!.title.isEmpty ? 'Untitled speech' : '“${stats.latestSpeech!.title}”', style: t.titleMedium),
            Text('Meeting #${stats.latestSpeech!.meetingNumber} · ${BdTime.calendarDate(stats.latestSpeech!.date)}', style: t.bodySmall),
          ]),
        ),
      ],
      if (stats != null) ...[
        const SectionLabel('Numbers'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 2.1,
            children: [
              tile('Speeches given', '${stats.speechesGiven}'),
              tile('Meetings attended', '${stats.meetingsAttended}'),
              tile('Projects completed', '${stats.projectsCompleted}'),
              tile('Meeting roles', '${stats.rolesTaken}'),
              tile('Current level', member.level == null ? '—' : 'Level ${member.level}'),
              tile('Member since', stats.joinedAt == null ? '—' : BdTime.calendarDate(stats.joinedAt!)),
            ],
          ),
        ),
      ],
    ]);
  }
}

class _History extends ConsumerWidget {
  const _History({required this.memberId});
  final String memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final history = ref.watch(memberHistoryProvider(memberId));
    return AsyncBody<List<HistoryEvent>>(
      value: history,
      errorTitle: 'Could not load the timeline',
      onRetry: () => ref.invalidate(memberHistoryProvider(memberId)),
      builder: (list) {
        if (list.isEmpty) {
          return const EmptyState(
            icon: PhosphorIconsRegular.clockCounterClockwise,
            title: 'Nothing on the timeline yet',
            message: 'Speeches, projects, and level milestones will show up here as they happen.',
          );
        }
        final out = <Widget>[];
        String? month;
        for (final e in list) {
          final m = BdTime.calendarMonthHeader(e.date);
          if (m != month) {
            month = m;
            out.add(SectionLabel(m));
          }
          final (icon, label, title, sub) = switch (e.type) {
            'speech-given' => (
                PhosphorIconsRegular.microphoneStage,
                'Speech given',
                (e.title ?? '').isEmpty ? 'Untitled speech' : '“${e.title}”',
                'Delivered at Meeting #${e.meetingNumber ?? '?'}${e.projectName == null ? '.' : ' for the ${e.projectName} project.'}'
              ),
            'project-started' => (PhosphorIconsRegular.flag, 'Project started', 'Started ${e.projectName ?? ''}',
                'Level ${e.level ?? '?'} project on the ${e.pathway ?? ''} pathway.'),
            'project-completed' => (PhosphorIconsRegular.checkCircle, 'Project completed', 'Completed ${e.projectName ?? ''}',
                'Level ${e.level ?? '?'} · ${e.pathway ?? ''}'),
            'level-reached' => (PhosphorIconsRegular.trophy, 'Level reached', 'Reached Level ${e.level ?? '?'}', 'On the ${e.pathway ?? ''} pathway.'),
            'role-taken' => (PhosphorIconsRegular.usersThree, 'Meeting role', 'Served as ${roleKeyLabel(e.roleName ?? '')}',
                'At Meeting #${e.meetingNumber ?? '?'}.'),
            'joined' => (PhosphorIconsRegular.sparkle, 'Joined the club', 'Joined the club', 'The journey begins here.'),
            _ => (PhosphorIconsRegular.circle, e.type, e.title ?? e.type, ''),
          };
          out.add(Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 17, color: c.inkSoft),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${label.toUpperCase()} · ${BdTime.calendarDate(e.date)}', style: t.labelSmall),
                  const SizedBox(height: 2),
                  Text(title, style: t.titleMedium),
                  if (sub.isNotEmpty) Text(sub, style: t.bodySmall),
                ]),
              ),
            ]),
          ));
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: out);
      },
    );
  }
}

class _UpdatePathwayForm extends ConsumerStatefulWidget {
  const _UpdatePathwayForm({required this.member});
  final Member member;
  @override
  ConsumerState<_UpdatePathwayForm> createState() => _UpdatePathwayFormState();
}

class _UpdatePathwayFormState extends ConsumerState<_UpdatePathwayForm> {
  late String? _pathway = widget.member.pathway;
  late String? _project = widget.member.startedProject;
  bool _busy = false;

  Future<void> _save(PathwayCatalog cat) async {
    final p = cat.byName(_pathway);
    final pr = p?.findProject(_project);
    if (p == null || pr == null) {
      showToast(context, 'Pick a pathway and a project', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).http.post('members/${widget.member.id}/pathway',
          body: {'pathway': p.name, 'project': pr.name, 'level': pr.level});
      HapticFeedback.mediumImpact();
      ref.invalidate(memberProvider(widget.member.id));
      ref.invalidate(memberStatsProvider(widget.member.id));
      ref.invalidate(memberHistoryProvider(widget.member.id));
      ref.invalidate(membersProvider);
      if (!mounted) return;
      showToast(context, 'Pathway updated');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final cat = ref.watch(pathwayCatalogProvider).value;
    if (cat == null) return const SizedBox(height: 200, child: Center(child: CircularProgressIndicator()));
    final p = cat.byName(_pathway);
    final pr = p?.findProject(_project);
    return SheetScaffold(
      title: 'Update pathway',
      subtitle: 'Change ${widget.member.firstName}’s pathway or current project. Past history stays put.',
      primaryLabel: 'Save changes',
      busy: _busy,
      onPrimary: () => _save(cat),
      children: [
        const FieldLabel('Pathway', required: true),
        DropdownButtonFormField<String>(
          initialValue: _pathway,
          isExpanded: true,
          hint: const Text('Select a Toastmasters pathway'),
          items: [for (final x in cat.pathways) DropdownMenuItem(value: x.name, child: Text(x.name))],
          onChanged: (v) => setState(() {
            _pathway = v;
            _project = null;
          }),
        ),
        const FieldLabel('Current project', required: true),
        DropdownButtonFormField<String>(
          key: ValueKey(_pathway),
          initialValue: p?.findProject(_project) == null ? null : _project,
          isExpanded: true,
          hint: Text(p == null ? 'Pick a pathway first' : 'Select a project'),
          items: [
            if (p != null)
              for (final x in p.allProjects)
                DropdownMenuItem(value: x.name, child: Text('${x.name} · Level ${x.level}', overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (v) => setState(() => _project = v),
        ),
        const SizedBox(height: 8),
        Text('Members migrating in mid-pathway can pick their real starting project — the level adjusts automatically.',
            style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
        const SizedBox(height: 12),
        Row(children: [
          Text('STARTING LEVEL', style: Theme.of(context).textTheme.labelSmall),
          const Spacer(),
          Text(pr == null ? '—' : 'Level ${pr.level}', style: Theme.of(context).textTheme.titleMedium),
        ]),
      ],
    );
  }
}
