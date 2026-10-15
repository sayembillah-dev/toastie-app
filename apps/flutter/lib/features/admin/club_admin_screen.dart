import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import '../meetings/meeting_common.dart';

final joinCodeProvider = FutureProvider<String?>((ref) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).joinCode();
});

final invitesProvider = FutureProvider<List<Invite>>((ref) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).invites();
});

/// Manage club hub (PRD §12.1).
class ClubAdminScreen extends ConsumerWidget {
  const ClubAdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final can = ref.watch(canProvider);
    if (!can(Act.read, 'memberRole')) return const AccessRestricted(title: 'Manage club');
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final code = ref.watch(joinCodeProvider);
    final members = ref.watch(membersProvider).value ?? const <Member>[];
    final invites = ref.watch(invitesProvider).value ?? const <Invite>[];
    final meetings = ref.watch(meetingsProvider).value ?? const <Meeting>[];
    final next = MeetingPartition.of(meetings, DateTime.now().toUtc()).current;
    final active = members.where((m) => m.isActive).toList();
    final officers = active.where((m) => m.roles.any((r) => r != 'Member')).length;

    Widget stat(String v, String l) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(v, style: t.headlineMedium),
            Text(l, style: t.bodySmall),
          ]),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Manage club')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(joinCodeProvider);
          ref.invalidate(invitesProvider);
          ref.invalidate(membersProvider);
          await ref.read(membersProvider.future);
        },
        child: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
          const SectionLabel('Club join code', padding: EdgeInsets.fromLTRB(16, 8, 16, 8)),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Share this with someone directly — they paste it in to join as a Member instantly.', style: t.bodySmall),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: Text(
                    code.value ?? '········',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: 4, fontFamily: 'Courier', color: c.ink),
                  ),
                ),
                IconButton(
                  tooltip: 'Copy code',
                  icon: const Icon(PhosphorIconsRegular.copy),
                  onPressed: code.value == null ? null : () => copyText(context, code.value!, 'Club code copied'),
                ),
                IconButton(
                  tooltip: 'Share code',
                  icon: const Icon(PhosphorIconsRegular.shareNetwork),
                  onPressed: code.value == null
                      ? null
                      : () => shareText(context, 'Join our club on Open Floor with the code ${code.value}'),
                ),
              ]),
            ]),
          ),
          const SizedBox(height: 12),
          AppCard(
            child: Row(children: [
              stat('${active.length}', 'Active members'),
              stat('$officers', 'Officers'),
              stat('${invites.where((i) => i.isPending).length}', 'Pending invites'),
            ]),
          ),
          const SectionLabel('Manage'),
          GroupCard(children: [
            RowTile(
              leading: const Icon(PhosphorIconsRegular.users),
              title: 'Members',
              subtitle: '${active.length} active on the roster',
              trailing: const Chevron(),
              onTap: () => context.push('/me/club-admin/members'),
            ),
            if (can(Act.read, 'memberPermission'))
              RowTile(
                leading: const Icon(PhosphorIconsRegular.shieldCheck),
                title: 'Permissions',
                subtitle: 'Roles and per-module overrides',
                trailing: const Chevron(),
                onTap: () => context.push('/me/club-admin/permissions'),
              ),
            if (can(Act.update, 'club'))
              RowTile(
                leading: const Icon(PhosphorIconsRegular.buildings),
                title: 'Club profile',
                subtitle: 'Name, venue, motto, socials, agenda banner',
                trailing: const Chevron(),
                onTap: () => context.push('/me/club-admin/profile'),
              ),
          ]),
          if (next != null) ...[
            const SectionLabel('Next meeting'),
            GroupCard(children: [
              RowTile(
                title: 'Meeting ${next.meetingNumber} · ${next.displayTheme}',
                subtitle: '${BdTime.meeting(next.dateTime)} · ${next.isPublished ? 'Published' : 'Draft'}',
                trailing: const Chevron(),
                onTap: () => context.push('/meetings/${next.id}'),
              ),
            ]),
          ],
        ]),
      ),
    );
  }
}
