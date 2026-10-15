import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../core/theme/tokens.dart';
import '../../domain/pathways.dart';
import '../../ui/widgets.dart';
import '../meetings/meeting_common.dart';
import 'role_state.dart';

class PersonPick {
  const PersonPick({required this.name, this.memberId, this.guestId, this.type});
  final String name;
  final String? memberId;
  final String? guestId;
  final String? type;
}

/// "Add speaker" sheet: search members/guests or type any name (guests who
/// aren't in the pipeline), plus an optional speaker type for the Timer.
Future<PersonPick?> pickPerson(BuildContext context, {required String title, List<String>? types}) {
  return showModalBottomSheet<PersonPick>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: _PersonPicker(title: title, types: types),
    ),
  );
}

class _PersonPicker extends ConsumerStatefulWidget {
  const _PersonPicker({required this.title, this.types});
  final String title;
  final List<String>? types;
  @override
  ConsumerState<_PersonPicker> createState() => _PersonPickerState();
}

class _PersonPickerState extends ConsumerState<_PersonPicker> {
  final _q = TextEditingController();
  late String? _type = widget.types?.first;

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  void _done(PersonPick p) => Navigator.pop(context, PersonPick(name: p.name, memberId: p.memberId, guestId: p.guestId, type: _type));

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final people = ref.watch(peopleProvider).value;
    final q = _q.text.trim().toLowerCase();
    final members = (people?.members ?? const []).where((m) => m.isActive && (q.isEmpty || m.name.toLowerCase().contains(q))).take(30).toList();
    final guests = (people?.guests ?? const []).where((g) => q.isNotEmpty && g.name.toLowerCase().contains(q)).take(15).toList();
    final typed = _q.text.trim();

    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.8,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
        ),
        if (widget.types != null)
          SizedBox(
            height: 44,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
              for (final t in widget.types!)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(label: Text(t), selected: _type == t, onSelected: (_) => setState(() => _type = t)),
                ),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: TextField(
            controller: _q,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) {
              if (typed.isNotEmpty) _done(PersonPick(name: typed));
            },
            decoration: const InputDecoration(
              hintText: 'Search or type a name…',
              prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
            ),
          ),
        ),
        Expanded(
          child: ListView(children: [
            if (typed.isNotEmpty)
              RowTile(
                leading: Icon(PhosphorIconsRegular.plusCircle, color: c.ink),
                title: 'Add “$typed”',
                subtitle: 'Not in the roster? Use the name as typed.',
                onTap: () => _done(PersonPick(name: typed)),
              ),
            for (final m in members)
              RowTile(
                dense: true,
                leading: Avatar(name: m.name, url: m.avatarUrl, size: 32),
                title: m.name,
                onTap: () => _done(PersonPick(name: m.name, memberId: m.id)),
              ),
            for (final g in guests)
              RowTile(
                dense: true,
                leading: Avatar(name: g.name, size: 32),
                title: '${g.name} (Guest)',
                onTap: () => _done(PersonPick(name: g.name, guestId: g.id)),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// Loads the agenda sources (speakers, evaluators, GE, TTE) for "Take from agenda".
Future<List<AgendaSource>> loadAgendaSources(WidgetRef ref, String meetingId) async {
  final speakers = await ref.read(speakersProvider(meetingId).future);
  final roles = await ref.read(meetingRolesProvider(meetingId).future);
  final people = await ref.read(peopleProvider.future);
  final catalog = await ref.read(pathwayCatalogProvider.future);
  return buildAgendaSources(speakers, roles, people, catalog);
}

/// App-bar action that shares the public role link + QR, so the role holder
/// can run the tool on their own phone without an account.
class ShareRoleAction extends ConsumerWidget {
  const ShareRoleAction({super.key, required this.meetingId, required this.role, required this.label});
  final String meetingId;
  final String role;
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meeting = ref.watch(meetingProvider(meetingId)).value;
    return IconButton(
      tooltip: 'Share $label role',
      icon: const Icon(PhosphorIconsRegular.qrCode),
      onPressed: meeting == null
          ? null
          : () => showQrSheet(
                context,
                title: '$label link',
                helper: 'The role holder can run the $label on their own phone — no account needed.',
                url: MeetingLinks.role(meeting, role),
              ),
    );
  }
}

/// Small "Syncing / Offline" indicator for the live tools.
class SyncDot extends StatelessWidget {
  const SyncDot({super.key, required this.offline});
  final bool offline;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Tooltip(
        message: offline ? 'Offline — changes are saved on this phone and sync when you reconnect' : 'Synced',
        child: Icon(
          offline ? PhosphorIconsRegular.cloudSlash : PhosphorIconsRegular.cloudCheck,
          size: 20,
          color: offline ? c.warning : c.inkMuted,
        ),
      ),
    );
  }
}
