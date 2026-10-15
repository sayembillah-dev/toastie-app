import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';

/// Labels as the web's permissions tab shows them.
const permissionResources = <String, String>{
  'club': 'Club',
  'member': 'Members — directory',
  'memberRole': 'Members — roles',
  'memberPermission': 'Members — permissions',
  'education': 'Education',
  'meeting': 'Meetings',
  'meetingRole': 'Meeting roles',
  'checklist': 'SAA checklist',
  'tableTopic': 'Table Topics',
  'attendance': 'Attendance',
  'guest': 'Guests',
  'guestLog': 'Guest log',
  'library': 'Library',
  'inventory': 'Inventory',
  'transaction': 'Finance — transactions',
  'budget': 'Finance — budgets',
  'dues': 'Finance — dues',
  'evaluation': 'Evaluations',
  'speechRequest': 'Speech requests',
  'task': 'Meeting tasks',
  'activityLog': 'Activity log',
  'invite': 'Invites',
  'joinRequest': 'Join requests',
  'report': 'Reports',
};

/// Per-member permission overrides (PRD §12.3). A switch shows the member's
/// effective access; landing back on the role default clears the override.
class PermissionsScreen extends ConsumerStatefulWidget {
  const PermissionsScreen({super.key});
  @override
  ConsumerState<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends ConsumerState<PermissionsScreen> {
  String? _memberId;
  final _filter = TextEditingController();
  final Set<String> _saving = {};

  @override
  void dispose() {
    _filter.dispose();
    super.dispose();
  }

  bool _roleAllows(Member m, String clubId, String resource, Act a) => can(
        PermissionSubject(userId: 'x', assignments: [ClubAssignment(clubId: clubId, membershipId: m.id, roles: m.roles)]),
        a,
        resource,
        Target(clubId: clubId),
      );

  Future<void> _set(Member m, Map<String, String> changes) async {
    setState(() => _saving.addAll(changes.keys));
    try {
      await ref.read(apiProvider).setMemberPermissions(m.id, changes);
      HapticFeedback.selectionClick();
      ref.invalidate(membersProvider);
      await ref.read(membersProvider.future);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _saving.removeAll(changes.keys));
    }
  }

  Future<void> _pickMember(List<Member> members) async {
    final m = await showModalBottomSheet<Member>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.8,
        builder: (ctx, scroll) => ListView(controller: scroll, children: [
          for (final x in members)
            RowTile(
              leading: Avatar(name: x.name, url: x.avatarUrl, size: 34),
              title: x.name,
              subtitle: '${x.rolesLabel}${x.overrides.isEmpty ? '' : ' · ${x.overrides.length} custom'}',
              onTap: () => Navigator.pop(ctx, x),
            ),
        ]),
      ),
    );
    if (m != null) setState(() => _memberId = m.id);
  }

  @override
  Widget build(BuildContext context) {
    final can0 = ref.watch(canProvider);
    if (!can0(Act.read, 'memberPermission')) return const AccessRestricted(title: 'Permissions');
    final canEdit = can0(Act.update, 'memberPermission');
    final clubId = ref.watch(signedInProvider)?.clubId ?? '';
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final members = ref.watch(membersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Permissions')),
      body: AsyncBody<List<Member>>(
        value: members,
        onRetry: () => ref.invalidate(membersProvider),
        builder: (all) {
          final active = all.where((m) => m.isActive).toList();
          final m = active.where((x) => x.id == _memberId).firstOrNull;
          final q = _filter.text.trim().toLowerCase();
          return ListView(padding: const EdgeInsets.only(bottom: 40), children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Text('Ticked means the member can do it. Changes apply immediately and are enforced across the app.',
                  style: t.bodySmall),
            ),
            AppCard(
              onTap: () => _pickMember(active),
              child: Row(children: [
                if (m != null) Avatar(name: m.name, url: m.avatarUrl, size: 36) else Icon(PhosphorIconsRegular.user, color: c.inkMuted),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m?.name ?? 'Select a member', style: t.titleMedium),
                    if (m != null) Text('${m.rolesLabel}${m.isClubAdmin ? ' · Club Admin' : ''}', style: t.bodySmall),
                  ]),
                ),
                const Icon(PhosphorIconsRegular.caretDown, size: 16),
              ]),
            ),
            if (m == null)
              const EmptyState(icon: PhosphorIconsRegular.shieldCheck, title: 'Pick a member', message: 'View or edit what they can do in this club.')
            else ...[
              if (m.isClubAdmin)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Text('Club Admins have full access; overrides still apply on top.', style: TextStyle(color: c.warning, fontSize: 13)),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _filter,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(hintText: 'Filter resources', prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20)),
                    ),
                  ),
                  if (canEdit && m.overrides.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: () async {
                        final ok = await confirmDialog(context,
                            title: 'Reset ${m.firstName}’s permissions?',
                            message: 'All ${m.overrides.length} custom settings go back to what their roles allow.',
                            confirmLabel: 'Reset');
                        if (ok) await _set(m, {for (final k in m.overrides.keys) k: 'default'});
                      },
                      child: const Text('Reset'),
                    ),
                  ],
                ]),
              ),
              for (final e in permissionResources.entries.where((e) => q.isEmpty || e.value.toLowerCase().contains(q)))
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: AppCard(
                    margin: EdgeInsets.zero,
                    padding: const EdgeInsets.fromLTRB(14, 10, 8, 6),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(e.value, style: t.titleMedium),
                      Wrap(children: [
                        for (final a in Act.values)
                          Builder(builder: (context) {
                            final key = overrideKey(e.key, a);
                            final base = m.isClubAdmin || _roleAllows(m, clubId, e.key, a);
                            final o = m.overrides[key];
                            final effective = o == 'allow' ? true : (o == 'deny' ? false : base);
                            return SizedBox(
                              width: 150,
                              child: Row(children: [
                                Switch.adaptive(
                                  value: effective,
                                  onChanged: !canEdit || _saving.contains(key)
                                      ? null
                                      : (v) => _set(m, {key: v == base ? 'default' : (v ? 'allow' : 'deny')}),
                                ),
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text('${a.name[0].toUpperCase()}${a.name.substring(1)}', style: const TextStyle(fontSize: 13.5)),
                                    if (o != null)
                                      Text(o == 'allow' ? 'allowed by override' : 'denied by override',
                                          style: TextStyle(fontSize: 11, color: o == 'allow' ? c.success : c.danger)),
                                  ]),
                                ),
                              ]),
                            );
                          }),
                      ]),
                    ]),
                  ),
                ),
            ],
          ]);
        },
      ),
    );
  }
}
