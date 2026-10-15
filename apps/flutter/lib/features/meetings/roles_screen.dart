import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../ui/widgets.dart';
import 'meeting_common.dart';

/// The ten role slots (PRD §7.4). Tap a row → assignee picker → PUT.
class RolesScreen extends ConsumerStatefulWidget {
  const RolesScreen({super.key, required this.meetingId});
  final String meetingId;
  @override
  ConsumerState<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends ConsumerState<RolesScreen> {
  final Set<String> _saving = {};

  Future<void> _assign(Meeting m, RoleDef def, Assignee? current) async {
    final res = await pickAssignee(context, title: def.label, current: current);
    if (res == null) return;
    final who = res.assignee;
    if (who?.id == current?.id && who?.isGuest == current?.isGuest) return;
    setState(() => _saving.add(def.key));
    try {
      await ref.read(apiProvider).setMeetingRole(m.id, def.key, who);
      tapHaptic();
      ref.invalidate(meetingRolesProvider(m.id));
      await ref.read(meetingRolesProvider(m.id).future);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _saving.remove(def.key));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final meeting = ref.watch(meetingProvider(widget.meetingId));
    final roles = ref.watch(meetingRolesProvider(widget.meetingId));
    final people = ref.watch(peopleProvider).value;
    final me = ref.watch(myMembershipIdProvider);
    final canEdit = ref.watch(canProvider)(Act.update, 'meetingRole');

    return Scaffold(
      appBar: AppBar(title: const Text('Meeting roles')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(meetingRolesProvider(widget.meetingId).future),
        child: AsyncBody<Meeting>(
          value: meeting,
          builder: (m) => AsyncBody<List<RoleAssignment>>(
            value: roles,
            onRetry: () => ref.invalidate(meetingRolesProvider(widget.meetingId)),
            builder: (list) {
              final byKey = {for (final r in list) r.roleKey: r};
              final defs = buildRoles(m);
              final filled = defs.where((d) => !d.optional && (byKey[d.key]?.filled ?? false)).length;
              final requiredCount = defs.where((d) => !d.optional).length;
              return ListView(physics: const AlwaysScrollableScrollPhysics(), children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: Text(
                    '$filled of $requiredCount required roles filled${canEdit ? ' · tap a role to assign it' : ''}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
                GroupCard(children: [
                  for (final d in defs)
                    Builder(builder: (context) {
                      final a = byKey[d.key];
                      final who = people?.assignee(membershipId: a?.membershipId, guestId: a?.guestId);
                      final isMe = a?.membershipId != null && a?.membershipId == me;
                      return RowTile(
                        leading: who == null
                            ? Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(color: c.fill, shape: BoxShape.circle),
                                child: Icon(PhosphorIconsRegular.userPlus, size: 18, color: c.inkMuted),
                              )
                            : Avatar(name: who.name, size: 38),
                        title: d.label,
                        subtitle: who == null
                            ? (d.optional ? 'Optional · open' : 'Open')
                            : '${who.name}${who.isGuest ? ' (Guest)' : ''}${isMe ? ' · You' : ''}',
                        trailing: _saving.contains(d.key)
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : (d.description != null
                                ? IconButton(
                                    tooltip: 'About this role',
                                    icon: Icon(PhosphorIconsRegular.info, size: 18, color: c.inkMuted),
                                    onPressed: () => showModalBottomSheet<void>(
                                      context: context,
                                      builder: (ctx) => SafeArea(
                                        child: Padding(
                                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                                          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                                            Text(d.label, style: Theme.of(ctx).textTheme.titleLarge),
                                            const SizedBox(height: 8),
                                            Text(d.description!, style: Theme.of(ctx).textTheme.bodyMedium),
                                          ]),
                                        ),
                                      ),
                                    ),
                                  )
                                : (canEdit ? const Chevron() : null)),
                        onTap: canEdit && !_saving.contains(d.key) ? () => _assign(m, d, who) : null,
                      );
                    }),
                ]),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  child: Text(
                    'Assigning or removing a member sends them a WhatsApp message once the meeting is published.',
                    style: TextStyle(fontSize: 12.5, color: c.inkMuted),
                  ),
                ),
              ]);
            },
          ),
        ),
      ),
    );
  }
}
