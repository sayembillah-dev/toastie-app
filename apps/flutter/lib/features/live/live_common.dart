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

/// Multi-select version of [pickPerson]: tick any number of members and
/// guests (or add typed names), then Done returns them all at once. People
/// already on the list are passed as [exclude] and left out. Returns null
/// when dismissed, an empty list never.
Future<List<PersonPick>?> pickPeople(
  BuildContext context, {
  required String title,
  List<PersonPick> exclude = const [],
}) {
  return showModalBottomSheet<List<PersonPick>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: _PeoplePicker(title: title, exclude: exclude),
    ),
  );
}

class _PeoplePicker extends ConsumerStatefulWidget {
  const _PeoplePicker({required this.title, required this.exclude});
  final String title;
  final List<PersonPick> exclude;
  @override
  ConsumerState<_PeoplePicker> createState() => _PeoplePickerState();
}

class _PeoplePickerState extends ConsumerState<_PeoplePicker> {
  final _q = TextEditingController();

  /// Picks in the order they were ticked, keyed so a re-tap unticks.
  final _picked = <String, PersonPick>{};

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  static String _key(PersonPick p) => p.memberId != null
      ? 'm:${p.memberId}'
      : p.guestId != null
          ? 'g:${p.guestId}'
          : 'n:${p.name.trim().toLowerCase()}';

  bool _excluded(PersonPick p) => widget.exclude.any((x) =>
      (p.memberId != null && x.memberId == p.memberId) ||
      (p.guestId != null && x.guestId == p.guestId) ||
      x.name.trim().toLowerCase() == p.name.trim().toLowerCase());

  void _toggle(PersonPick p) => setState(() {
        final k = _key(p);
        if (_picked.remove(k) == null) _picked[k] = p;
      });

  void _addTyped(String typed) {
    final p = PersonPick(name: typed);
    if (_excluded(p)) return;
    setState(() {
      _picked[_key(p)] = p;
      _q.clear();
    });
  }

  Widget _tile(PersonPick p, {String? label, String? avatarUrl}) {
    final on = _picked.containsKey(_key(p));
    return RowTile(
      dense: true,
      leading: Avatar(name: p.name, url: avatarUrl, size: 32),
      title: label ?? p.name,
      trailing: Checkbox(value: on, onChanged: (_) => _toggle(p)),
      onTap: () => _toggle(p),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final people = ref.watch(peopleProvider).value;
    final q = _q.text.trim().toLowerCase();
    final typed = _q.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    final members = (people?.members ?? const [])
        .where((m) => m.isActive && (q.isEmpty || m.name.toLowerCase().contains(q)))
        .map((m) => (pick: PersonPick(name: m.name, memberId: m.id), url: m.avatarUrl))
        .where((e) => !_excluded(e.pick))
        .take(50)
        .toList();
    final guests = (people?.guests ?? const [])
        .where((g) => q.isNotEmpty && g.name.toLowerCase().contains(q))
        .map((g) => PersonPick(name: g.name, guestId: g.id))
        .where((p) => !_excluded(p))
        .take(15)
        .toList();
    final typedPicks = _picked.values.where((p) => p.memberId == null && p.guestId == null).toList();
    final canAddTyped = typed.isNotEmpty &&
        !_excluded(PersonPick(name: typed)) &&
        !_picked.containsKey(_key(PersonPick(name: typed))) &&
        !members.any((e) => e.pick.name.toLowerCase() == typed.toLowerCase());
    final count = _picked.length;

    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.8,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: TextField(
            controller: _q,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) {
              if (canAddTyped) _addTyped(typed);
            },
            decoration: const InputDecoration(
              hintText: 'Search or type a name…',
              prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
            ),
          ),
        ),
        Expanded(
          child: ListView(children: [
            if (canAddTyped)
              RowTile(
                leading: Icon(PhosphorIconsRegular.plusCircle, color: c.ink),
                title: 'Add “$typed”',
                subtitle: 'Not in the roster? Use the name as typed.',
                onTap: () => _addTyped(typed),
              ),
            for (final p in typedPicks) _tile(p),
            for (final e in members) _tile(e.pick, avatarUrl: e.url),
            for (final g in guests) _tile(g, label: '${g.name} (Guest)'),
          ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: FilledButton(
              onPressed: count == 0 ? null : () => Navigator.pop(context, _picked.values.toList()),
              child: Text(count == 0 ? 'Select people' : 'Done · add $count'),
            ),
          ),
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
