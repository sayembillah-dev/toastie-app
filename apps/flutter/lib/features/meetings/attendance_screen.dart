import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';

final attendanceMembersProvider = FutureProvider.family<Map<String, bool>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).attendanceMembers(id);
});

final attendanceGuestsProvider = FutureProvider.family<List<AttendanceGuest>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).attendanceGuests(id);
});

/// Attendance (PRD §7.11). Optimistic switches; attendance also writes guest
/// visit logs server-side.
class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key, required this.meetingId});
  final String meetingId;
  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  final Map<String, bool> _pending = {}; // optimistic member toggles
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  String get _id => widget.meetingId;

  Future<void> _toggleMember(String membershipId, bool present) async {
    HapticFeedback.selectionClick();
    setState(() => _pending[membershipId] = present);
    try {
      await ref.read(apiProvider).setMemberAttendance(_id, membershipId, present);
      ref.invalidate(attendanceMembersProvider(_id));
      await ref.read(attendanceMembersProvider(_id).future);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _pending.remove(membershipId));
    }
  }

  Future<void> _markAll(bool present) async {
    if (!present) {
      final ok = await confirmDialog(context, title: 'Clear attendance?', message: 'Everyone is marked absent.', confirmLabel: 'Clear');
      if (!ok) return;
    }
    try {
      await ref.read(apiProvider).markAllAttendance(_id, present);
      HapticFeedback.mediumImpact();
      ref.invalidate(attendanceMembersProvider(_id));
      ref.invalidate(attendanceGuestsProvider(_id));
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  Future<void> _addGuest() async {
    final guests = await ref.read(guestsProvider.future).catchError((_) => <Guest>[]);
    final already = (ref.read(attendanceGuestsProvider(_id)).value ?? const []).map((g) => g.guestId).toSet();
    if (!mounted) return;
    final picked = await showModalBottomSheet<Guest>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _GuestPicker(guests: guests.where((g) => !already.contains(g.id)).toList()),
    );
    if (picked == null) return;
    try {
      await ref.read(apiProvider).addAttendanceGuest(_id, picked.id);
      ref.invalidate(attendanceGuestsProvider(_id));
      ref.invalidate(guestsProvider);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final canEdit = ref.watch(canProvider)(Act.update, 'attendance');
    final members = ref.watch(membersProvider);
    final present = ref.watch(attendanceMembersProvider(_id));
    final guests = ref.watch(attendanceGuestsProvider(_id));
    final q = _q.text.trim().toLowerCase();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        actions: [
          if (canEdit)
            IconButton(
              tooltip: 'More',
              icon: const Icon(PhosphorIconsBold.dotsThreeVertical),
              onPressed: () => showActionSheet(context, actions: [
                SheetAction(icon: PhosphorIconsRegular.checks, label: 'Mark all present', onTap: () => _markAll(true)),
                SheetAction(icon: PhosphorIconsRegular.eraser, label: 'Clear', destructive: true, onTap: () => _markAll(false)),
              ]),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(attendanceGuestsProvider(_id));
          ref.invalidate(attendanceMembersProvider(_id));
          await ref.read(attendanceMembersProvider(_id).future);
        },
        child: AsyncBody<List<Member>>(
          value: members,
          errorTitle: 'Could not load attendance',
          onRetry: () => ref.invalidate(membersProvider),
          builder: (all) {
            final active = all.where((m) => m.isActive).toList();
            final map = present.value ?? const <String, bool>{};
            bool isIn(String id) => _pending[id] ?? map[id] ?? false;
            final count = active.where((m) => isIn(m.id)).length;
            final list = active.where((m) => q.isEmpty || m.name.toLowerCase().contains(q)).toList();
            final g = guests.value ?? const <AttendanceGuest>[];

            return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 40), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Row(children: [
                  Text('$count', style: Theme.of(context).textTheme.headlineMedium),
                  Text(' of ${active.length} members · ${g.where((x) => x.present).length} guests',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: c.inkSoft)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  controller: _q,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    hintText: 'Search members',
                    prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
                  ),
                ),
              ),
              const SectionLabel('Members', padding: EdgeInsets.fromLTRB(16, 8, 16, 8)),
              GroupCard(children: [
                for (final m in list)
                  RowTile(
                    dense: true,
                    leading: Avatar(name: m.name, url: m.avatarUrl, size: 34),
                    title: m.name,
                    trailing: Switch.adaptive(
                      value: isIn(m.id),
                      onChanged: canEdit ? (v) => _toggleMember(m.id, v) : null,
                    ),
                    onTap: canEdit ? () => _toggleMember(m.id, !isIn(m.id)) : null,
                  ),
              ]),
              SectionLabel(
                'Guests',
                trailing: canEdit
                    ? GestureDetector(
                        onTap: _addGuest,
                        child: Text('Add guest', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.ink)),
                      )
                    : null,
              ),
              if (g.isEmpty)
                AppCard(child: Text('No guests recorded for this meeting.', style: Theme.of(context).textTheme.bodySmall))
              else
                GroupCard(children: [
                  for (final x in g)
                    RowTile(
                      dense: true,
                      leading: Avatar(name: x.name, size: 34),
                      title: x.name,
                      subtitle: 'Guest',
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        Switch.adaptive(
                          value: x.present,
                          onChanged: canEdit
                              ? (v) async {
                                  await ref.read(apiProvider).updateAttendanceGuest(_id, x.id, present: v).catchError((_) {});
                                  ref.invalidate(attendanceGuestsProvider(_id));
                                }
                              : null,
                        ),
                        if (canEdit)
                          IconButton(
                            tooltip: 'Remove guest',
                            icon: Icon(PhosphorIconsRegular.x, size: 18, color: c.inkMuted),
                            onPressed: () async {
                              await ref.read(apiProvider).deleteAttendanceGuest(_id, x.id).catchError((_) {});
                              ref.invalidate(attendanceGuestsProvider(_id));
                            },
                          ),
                      ]),
                    ),
                ]),
            ]);
          },
        ),
      ),
    );
  }
}

class _GuestPicker extends StatefulWidget {
  const _GuestPicker({required this.guests});
  final List<Guest> guests;
  @override
  State<_GuestPicker> createState() => _GuestPickerState();
}

class _GuestPickerState extends State<_GuestPicker> {
  final _q = TextEditingController();
  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = _q.text.trim().toLowerCase();
    final list = widget.guests.where((g) => q.isEmpty || g.name.toLowerCase().contains(q)).toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      builder: (ctx, scroll) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: TextField(
            controller: _q,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Search guests',
              prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
            ),
          ),
        ),
        Expanded(
          child: list.isEmpty
              ? const EmptyState(
                  icon: PhosphorIconsRegular.usersThree,
                  title: 'No guests in the pipeline',
                  message: 'Add them on the People tab first.',
                )
              : ListView(controller: scroll, children: [
                  for (final g in list)
                    RowTile(
                      leading: Avatar(name: g.name, size: 34),
                      title: g.name,
                      subtitle: GuestStage.fromId(g.stage).label,
                      onTap: () => Navigator.pop(context, g),
                    ),
                ]),
        ),
      ]),
    );
  }
}
