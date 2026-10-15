import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/theme_mode.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/pathways.dart';
import '../../ui/widgets.dart';
import '../home/home_screen.dart' show ClubStandingCard, PathwayProgressCard;
import 'context_switcher.dart';
import 'speech_cards.dart';

class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(signedInProvider);
    if (s == null) return const SizedBox.shrink();
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final user = s.session.user;
    final membership = s.membership;
    final me = membership?.membershipId;
    final member = me == null ? null : ref.watch(memberProvider(me)).value;
    final stats = me == null ? null : ref.watch(memberStatsProvider(me)).value;
    final catalog = ref.watch(pathwayCatalogProvider).value;
    final meetings = ref.watch(meetingsProvider).value;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          if (me != null) {
            ref.invalidate(memberProvider(me));
            ref.invalidate(memberStatsProvider(me));
            ref.invalidate(speechSlotRequestsProvider(me));
            ref.invalidate(memberHistoryProvider(me));
          }
          await ref.read(authProvider.notifier).refreshSession().catchError((_) {});
        },
        child: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Row(children: [
                Avatar(name: user.name, url: user.avatarUrl, size: 64),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(user.name, style: t.headlineMedium),
                    if (membership != null)
                      Text(
                        [
                          membership.roles.map(roleLabel).join(', '),
                          if (member?.pathway != null) 'Pursuing ${member!.pathway}, Level ${member.level ?? 1}',
                        ].join(' · '),
                        style: t.bodySmall,
                      ),
                    if (stats?.joinedAt != null)
                      Text(
                        'Member since ${DateFormat('MMMM y', 'en_GB').format(DateTime.parse(stats!.joinedAt!))} · ${stats.meetingsAttended} meetings attended',
                        style: t.bodySmall,
                      ),
                  ]),
                ),
              ]),
            ),
          ),
          if (user.mustChangePassword)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Material(
                color: c.warningSoft,
                borderRadius: BorderRadius.circular(12),
                child: ListTile(
                  leading: Icon(PhosphorIconsFill.warning, color: c.warning),
                  title: const Text('Change your password'),
                  subtitle: const Text('You’re using a temporary password.'),
                  trailing: const Chevron(),
                  onTap: () => context.push('/me/password'),
                ),
              ),
            ),
          if (me != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Row(children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => showSpeechSlotSheet(context, ref, me),
                    icon: const Icon(PhosphorIconsRegular.handWaving, size: 18),
                    label: const Text('Request speech slot'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50)),
                    onPressed: () => context.push('/me/pathway/$me'),
                    icon: const Icon(PhosphorIconsRegular.path, size: 18),
                    label: const Text('Pathway detail'),
                  ),
                ),
              ]),
            ),
            if (member != null) ...[
              const SectionLabel('Current pathway'),
              PathwayProgressCard(
                member: member,
                catalog: catalog,
                history: ref.watch(memberHistoryProvider(me)).value ?? const <HistoryEvent>[],
                onTap: () => context.push('/me/pathway/$me'),
              ),
            ],
            _SpeechesPreview(membershipId: me),
            if (stats != null && meetings != null) ...[
              const SectionLabel('Club standing'),
              ClubStandingCard(stats: stats, meetings: meetings),
            ],
            _SlotRequests(membershipId: me),
          ],
          if (me != null && ref.watch(canProvider)(Act.read, 'memberRole')) ...[
            const SectionLabel('Club'),
            GroupCard(children: [
              RowTile(
                leading: const Icon(PhosphorIconsRegular.gearSix),
                title: 'Manage club',
                subtitle: 'Members, permissions, club profile',
                trailing: const Chevron(),
                onTap: () => context.push('/me/club-admin'),
              ),
            ]),
          ],
          const SectionLabel('Account'),
          GroupCard(children: [
            RowTile(
              leading: const Icon(PhosphorIconsRegular.userCircle),
              title: 'Edit profile',
              trailing: const Chevron(),
              onTap: () => context.push('/me/profile'),
            ),
            RowTile(
              leading: const Icon(PhosphorIconsRegular.lockKey),
              title: 'Change password',
              trailing: const Chevron(),
              onTap: () => context.push('/me/password'),
            ),
            if (s.session.contexts.length > 1)
              RowTile(
                leading: const Icon(PhosphorIconsRegular.arrowsLeftRight),
                title: 'Switch context',
                subtitle: s.context?.label,
                trailing: const Chevron(),
                onTap: () => showContextSwitcher(context, ref),
              ),
            RowTile(
              leading: const Icon(PhosphorIconsRegular.circleHalf),
              title: 'Appearance',
              subtitle: ref.watch(themeModeProvider).label,
              trailing: const Chevron(),
              onTap: () => _pickAppearance(context, ref),
            ),
            const RowTile(
              leading: Icon(PhosphorIconsRegular.bell),
              title: 'Notifications',
              subtitle: 'Coming soon — WhatsApp messages cover roles and meetings for now.',
            ),
          ]),
          const SizedBox(height: 16),
          GroupCard(children: [
            RowTile(
              leading: Icon(PhosphorIconsRegular.signOut, color: c.ink),
              title: 'Sign out',
              onTap: () async {
                final ok = await confirmDialog(context, title: 'Sign out of Open Floor?', confirmLabel: 'Sign out');
                if (ok) await ref.read(authProvider.notifier).signOut();
              },
            ),
          ]),
          Center(
            child: TextButton(
              style: TextButton.styleFrom(foregroundColor: c.inkMuted),
              onPressed: () => context.push('/me/delete-account'),
              child: const Text('Delete account'),
            ),
          ),
        ]),
      ),
    );
  }
}

class _SpeechesPreview extends ConsumerWidget {
  const _SpeechesPreview({required this.membershipId});
  final String membershipId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final speeches = ref.watch(mySpeechesProvider(membershipId)).value;
    if (speeches == null) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionLabel(
        'My speeches',
        trailing: speeches.length > 1
            ? GestureDetector(
                onTap: () => context.push('/me/speeches'),
                child: Text('All ${speeches.length}',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.of(context).ink)),
              )
            : null,
      ),
      if (speeches.isEmpty)
        const AppCard(
          child: EmptyState(
            icon: PhosphorIconsRegular.microphone,
            title: 'No speeches yet',
            message: 'Once you deliver your first prepared speech, its reports will show up here.',
          ),
        )
      else
        SpeechCard(speech: speeches.first),
    ]);
  }
}

class _SlotRequests extends ConsumerWidget {
  const _SlotRequests({required this.membershipId});
  final String membershipId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final requests = ref.watch(speechSlotRequestsProvider(membershipId)).value;
    final meetings = ref.watch(meetingsProvider).value ?? const <Meeting>[];
    final byId = {for (final m in meetings) m.id: m};
    if (requests == null) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionLabel('Speech slot requests'),
      if (requests.isEmpty)
        AppCard(
          child: Text('No requests yet — ask the VPE for your next slot whenever you’re ready.',
              style: Theme.of(context).textTheme.bodySmall),
        )
      else
        GroupCard(children: [
          for (final r in requests)
            RowTile(
              title: byId[r.meetingId] == null ? 'Meeting' : 'Meeting #${byId[r.meetingId]!.meetingNumber} · ${BdTime.date(byId[r.meetingId]!.dateTime)}',
              subtitle: [if (r.projectName != null) r.projectName!, if (r.note != null) r.note!].join(' · '),
              trailing: Pill(
                r.statusLabel,
                color: switch (r.status) { 'approved' => c.success, 'declined' => c.danger, _ => c.warning },
                background: switch (r.status) { 'approved' => c.successSoft, 'declined' => c.dangerSoft, _ => c.warningSoft },
              ),
            ),
        ]),
    ]);
  }
}

/// Request a speech slot (PRD §11.2).
Future<void> showSpeechSlotSheet(BuildContext context, WidgetRef ref, String membershipId) async {
  final sent = await showFormSheet<bool>(context, builder: (_) => _SpeechSlotForm(membershipId: membershipId));
  if (sent == true && context.mounted) showToast(context, 'Request sent to the VPE');
}

class _SpeechSlotForm extends ConsumerStatefulWidget {
  const _SpeechSlotForm({required this.membershipId});
  final String membershipId;
  @override
  ConsumerState<_SpeechSlotForm> createState() => _SpeechSlotFormState();
}

class _SpeechSlotFormState extends ConsumerState<_SpeechSlotForm> {
  String? _meetingId;
  final _project = TextEditingController();
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _project.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_meetingId == null) {
      showToast(context, 'Choose an upcoming meeting', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).requestSpeechSlot(
            widget.membershipId,
            meetingId: _meetingId!,
            project: _project.text.trim(),
            note: _note.text.trim(),
          );
      HapticFeedback.mediumImpact();
      ref.invalidate(speechSlotRequestsProvider(widget.membershipId));
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final meetings = ref.watch(meetingsProvider).value ?? const <Meeting>[];
    final upcoming = MeetingPartition.of(meetings, DateTime.now().toUtc()).upcoming;
    return SheetScaffold(
      title: 'Request a speech slot',
      primaryLabel: 'Send to VPE',
      busy: _busy,
      onPrimary: _send,
      children: [
        const FieldLabel('Meeting'),
        if (upcoming.isEmpty)
          Text('No upcoming meetings yet.', style: Theme.of(context).textTheme.bodySmall)
        else
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final m in upcoming)
              ChoiceChip(
                label: Text('#${m.meetingNumber} · ${BdTime.date(m.dateTime)}'),
                selected: _meetingId == m.id,
                onSelected: (_) => setState(() => _meetingId = m.id),
              ),
          ]),
        const FieldLabel('Project', optional: true),
        TextField(
          controller: _project,
          maxLength: SpeechSlotRequest.projectMax,
          decoration: const InputDecoration(hintText: 'e.g. Reflect on Your Path', counterText: ''),
        ),
        const FieldLabel('Note to the VPE', optional: true),
        TextField(
          controller: _note,
          maxLength: SpeechSlotRequest.noteMax,
          maxLines: 3,
          minLines: 2,
          decoration: const InputDecoration(hintText: 'Anything they should know when building the agenda'),
        ),
      ],
    );
  }
}

void _pickAppearance(BuildContext context, WidgetRef ref) {
  final current = ref.read(themeModeProvider);
  showActionSheet(context, title: 'Appearance', actions: [
    for (final (mode, icon) in const [
      (ThemeMode.light, PhosphorIconsRegular.sun),
      (ThemeMode.dark, PhosphorIconsRegular.moon),
      (ThemeMode.system, PhosphorIconsRegular.deviceMobile),
    ])
      SheetAction(
        icon: icon,
        label: mode.label,
        subtitle: mode == current ? 'Current' : null,
        onTap: () => ref.read(themeModeProvider.notifier).set(mode),
      ),
  ]);
}
