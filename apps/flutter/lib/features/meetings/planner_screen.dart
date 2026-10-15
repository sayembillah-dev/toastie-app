import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'meeting_common.dart';
import 'meetings_screen.dart' show PickerField;

final plannerRowsProvider = FutureProvider<List<PlannerRow>>((ref) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).plannerRows();
});

/// Term planner (PRD §7.16): draft a term of meetings, then spin a row up
/// into a real (draft) meeting with its roles and speakers carried over.
class PlannerScreen extends ConsumerStatefulWidget {
  const PlannerScreen({super.key});
  @override
  ConsumerState<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends ConsumerState<PlannerScreen> {
  String _lens = 'All roles';
  final Set<String> _saving = {};

  Future<void> _assign(PlannerRow row, String slot, People people) async {
    final current = _assigneeOf(row, slot, people);
    final res = await pickAssignee(context, title: plannerSlots[slot]!, current: current);
    if (res == null) return;
    final next = {...row.assignees, slot: PlannerRow.assigneeJson(res.assignee)};
    setState(() => _saving.add('${row.id}:$slot'));
    try {
      await ref.read(apiProvider).updatePlannerRow(row.id, {'assignees': next});
      tapHaptic();
      ref.invalidate(plannerRowsProvider);
      await ref.read(plannerRowsProvider.future);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _saving.remove('${row.id}:$slot'));
    }
  }

  Assignee? _assigneeOf(PlannerRow row, String slot, People people) {
    final a = row.assignees[slot];
    if (a is! Map) return null;
    if (a['kind'] == 'member' && a['memberId'] is String) {
      final id = a['memberId'] as String;
      return Assignee.member(id, people.member(id)?.name ?? 'Unknown member');
    }
    if (a['kind'] == 'guest') {
      return Assignee.guest('${a['guestId'] ?? ''}', '${a['name'] ?? 'Guest'}');
    }
    return null;
  }

  Future<void> _addRow() async {
    try {
      final row = await ref.read(apiProvider).createPlannerRow();
      ref.invalidate(plannerRowsProvider);
      if (mounted) await _editDetails(row);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  Future<void> _editDetails(PlannerRow row) async {
    await showFormSheet<void>(context, builder: (_) => _RowDetailsForm(row: row));
  }

  Future<void> _createMeeting(PlannerRow row) async {
    final created = await showFormSheet<Meeting>(context, builder: (_) => _CreateFromRowForm(row: row));
    if (created != null && mounted) {
      showToast(context, 'Meeting #${created.meetingNumber} created as a draft');
      context.push('/meetings/${created.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final can = ref.watch(canProvider);
    if (!can(Act.read, 'education')) return const AccessRestricted(title: 'Planner');
    final canEdit = can(Act.update, 'education');
    final rows = ref.watch(plannerRowsProvider);
    final people = ref.watch(peopleProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text('Planner')),
      floatingActionButton: can(Act.create, 'education')
          ? FloatingActionButton.extended(
              onPressed: _addRow,
              icon: const Icon(PhosphorIconsBold.plus),
              label: const Text('Add meeting'),
              shape: const StadiumBorder(),
            )
          : null,
      body: Column(children: [
        SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
            for (final l in plannerLenses.keys)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(l), selected: _lens == l, onSelected: (_) => setState(() => _lens = l)),
              ),
          ]),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(plannerRowsProvider.future),
            child: AsyncBody<List<PlannerRow>>(
              value: rows,
              onRetry: () => ref.invalidate(plannerRowsProvider),
              builder: (list) {
                if (people == null) return const SkeletonList(count: 3, height: 200);
                if (list.isEmpty) {
                  return ListView(children: const [
                    SizedBox(height: 40),
                    EmptyState(
                      icon: PhosphorIconsRegular.calendarPlus,
                      title: 'No meetings planned yet',
                      message: 'Tap Add meeting to start the first row.',
                    ),
                  ]);
                }
                final dated = list.where((r) => r.dateTime != null).toList()..sort((a, b) => a.dateTime!.compareTo(b.dateTime!));
                final undated = list.where((r) => r.dateTime == null).toList();
                final out = <Widget>[];
                String? month;
                for (final r in dated) {
                  final m = BdTime.monthHeader(r.dateTime!);
                  if (m != month) {
                    month = m;
                    out.add(SectionLabel(m));
                  }
                  out.add(_card(r, people, canEdit));
                }
                if (undated.isNotEmpty) {
                  out.add(const SectionLabel('Not scheduled'));
                  out.addAll(undated.map((r) => _card(r, people, canEdit)));
                }
                return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 100), children: out);
              },
            ),
          ),
        ),
      ]),
    );
  }

  Widget _card(PlannerRow r, People people, bool canEdit) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final lensSlots = plannerLenses[_lens]!;
    final slots = lensSlots.isEmpty ? plannerSlots.keys.toList() : lensSlots;
    final linked = r.meetingId != null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Material(
        color: linked ? c.successSoft : c.canvas,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: linked ? c.success.withValues(alpha: 0.4) : c.line)),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 4, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(r.meetingNumber == null ? 'Planned meeting' : 'Meeting #${r.meetingNumber}', style: t.titleMedium),
                  Text(r.dateTime == null ? 'No date set' : BdTime.meeting(r.dateTime!), style: t.bodySmall),
                  if (r.theme.isNotEmpty) Text(r.theme, style: t.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
                ]),
              ),
              if (linked)
                TextButton(onPressed: () => context.push('/meetings/${r.meetingId}'), child: const Text('Open')),
              if (canEdit)
                IconButton(
                  tooltip: 'Row actions',
                  icon: const Icon(PhosphorIconsBold.dotsThreeVertical),
                  onPressed: () => showActionSheet(context, actions: [
                    SheetAction(icon: PhosphorIconsRegular.pencilSimple, label: 'Edit details', onTap: () => _editDetails(r)),
                    if (!linked)
                      SheetAction(
                        icon: PhosphorIconsRegular.calendarPlus,
                        label: 'Create meeting',
                        subtitle: 'A draft meeting with these roles and speakers',
                        onTap: () => _createMeeting(r),
                      ),
                    SheetAction(
                      icon: PhosphorIconsRegular.trash,
                      label: 'Delete row',
                      destructive: true,
                      onTap: () async {
                        final ok = await confirmDialog(context, title: 'Delete this row?', confirmLabel: 'Delete', destructive: true);
                        if (!ok) return;
                        await ref.read(apiProvider).deletePlannerRow(r.id).catchError((_) {});
                        ref.invalidate(plannerRowsProvider);
                      },
                    ),
                  ]),
                ),
            ]),
            const SizedBox(height: 4),
            for (final slot in slots)
              Builder(builder: (context) {
                final who = _assigneeOf(r, slot, people);
                final saving = _saving.contains('${r.id}:$slot');
                return InkWell(
                  onTap: canEdit && !saving ? () => _assign(r, slot, people) : null,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(0, 7, 10, 7),
                    child: Row(children: [
                      SizedBox(width: 118, child: Text(plannerSlots[slot]!, style: TextStyle(fontSize: 13.5, color: c.inkSoft))),
                      Expanded(
                        child: saving
                            ? const Align(
                                alignment: Alignment.centerLeft,
                                child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                              )
                            : Text(
                                who == null ? '+ Assign' : '${who.name}${who.isGuest ? ' (Guest)' : ''}',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: who == null ? FontWeight.w500 : FontWeight.w600,
                                  color: who == null ? c.inkMuted : c.ink,
                                ),
                              ),
                      ),
                    ]),
                  ),
                );
              }),
          ]),
        ),
      ),
    );
  }
}

class _RowDetailsForm extends ConsumerStatefulWidget {
  const _RowDetailsForm({required this.row});
  final PlannerRow row;
  @override
  ConsumerState<_RowDetailsForm> createState() => _RowDetailsFormState();
}

class _RowDetailsFormState extends ConsumerState<_RowDetailsForm> {
  late final _number = TextEditingController(text: widget.row.meetingNumber?.toString() ?? '');
  late final _theme = TextEditingController(text: widget.row.theme);
  late final _notes = TextEditingController(text: widget.row.notes);
  DateTime? _date;
  TimeOfDay _time = const TimeOfDay(hour: 19, minute: 0);
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final d = widget.row.dateTime;
    if (d != null) {
      final w = BdTime.wall(d);
      _date = DateTime(w.year, w.month, w.day);
      _time = TimeOfDay(hour: w.hour, minute: w.minute);
    }
  }

  @override
  void dispose() {
    _number.dispose();
    _theme.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).updatePlannerRow(widget.row.id, {
        'meetingNumber': int.tryParse(_number.text),
        'dateTime': _date == null
            ? null
            : BdTime.fromWall(_date!.year, _date!.month, _date!.day, _time.hour, _time.minute).toIso8601String(),
        'theme': _theme.text.trim(),
        'notes': _notes.text.trim(),
      });
      ref.invalidate(plannerRowsProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SheetScaffold(
      title: 'Edit details',
      primaryLabel: 'Save',
      busy: _busy,
      onPrimary: _save,
      children: [
        const FieldLabel('Meeting number', optional: true),
        TextField(controller: _number, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly]),
        const FieldLabel('Date & time', optional: true),
        Row(children: [
          Expanded(
            child: PickerField(
              icon: PhosphorIconsRegular.calendarBlank,
              label: _date == null ? 'No date' : BdTime.date(BdTime.fromWall(_date!.year, _date!.month, _date!.day, 12, 0)),
              placeholder: _date == null,
              onTap: () async {
                final now = DateTime.now();
                final d = await showDatePicker(
                  context: context,
                  initialDate: _date ?? now,
                  firstDate: DateTime(now.year - 1),
                  lastDate: DateTime(now.year + 2),
                );
                if (d != null) setState(() => _date = d);
              },
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 130,
            child: PickerField(
              icon: PhosphorIconsRegular.clock,
              label: _time.format(context),
              onTap: () async {
                final t = await showTimePicker(context: context, initialTime: _time);
                if (t != null) setState(() => _time = t);
              },
            ),
          ),
        ]),
        const FieldLabel('Theme', optional: true),
        TextField(controller: _theme, maxLength: 120, decoration: const InputDecoration(hintText: 'Meeting theme…', counterText: '')),
        const FieldLabel('Notes', optional: true),
        TextField(controller: _notes, maxLines: 3, minLines: 2, decoration: const InputDecoration(hintText: 'Anything to remember…')),
      ],
    );
  }
}

class _CreateFromRowForm extends ConsumerStatefulWidget {
  const _CreateFromRowForm({required this.row});
  final PlannerRow row;
  @override
  ConsumerState<_CreateFromRowForm> createState() => _CreateFromRowFormState();
}

class _CreateFromRowFormState extends ConsumerState<_CreateFromRowForm> {
  late final _number = TextEditingController(text: widget.row.meetingNumber?.toString() ?? '');
  late final _theme = TextEditingController(text: widget.row.theme);
  DateTime? _date;
  TimeOfDay _time = const TimeOfDay(hour: 19, minute: 0);
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final d = widget.row.dateTime;
    if (d != null) {
      final w = BdTime.wall(d);
      _date = DateTime(w.year, w.month, w.day);
      _time = TimeOfDay(hour: w.hour, minute: w.minute);
    }
  }

  @override
  void dispose() {
    _number.dispose();
    _theme.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final n = int.tryParse(_number.text);
    if (n == null || _date == null || _theme.text.trim().isEmpty) {
      showToast(context, 'Meeting number, date and theme are required', error: true);
      return;
    }
    setState(() => _busy = true);
    final api = ref.read(apiProvider);
    final instant = BdTime.fromWall(_date!.year, _date!.month, _date!.day, _time.hour, _time.minute);
    try {
      final created = await api.createMeeting(number: n, dateTime: instant, theme: _theme.text.trim());
      // Linking the row carries its roles and prepared speakers onto the
      // meeting server-side (syncMeetingFromPlannerRow).
      try {
        await api.updatePlannerRow(widget.row.id, {
          'meetingId': created.id,
          'meetingNumber': n,
          'dateTime': instant.toIso8601String(),
          'theme': _theme.text.trim(),
          'notes': widget.row.notes,
          'assignees': widget.row.assignees,
        });
      } catch (_) {
        if (mounted) showToast(context, 'Meeting created, but some details did not carry over — check its Roles', error: true);
      }
      ref.invalidate(plannerRowsProvider);
      ref.invalidate(meetingsProvider);
      if (mounted) Navigator.pop(context, created);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filled = widget.row.assignees.values.where((v) => v != null).length;
    return SheetScaffold(
      title: 'Create meeting from planner',
      subtitle: '$filled assigned slot${filled == 1 ? '' : 's'} carry over. The meeting starts as a draft.',
      primaryLabel: 'Create meeting',
      busy: _busy,
      onPrimary: _create,
      children: [
        const FieldLabel('Meeting no.'),
        TextField(controller: _number, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly]),
        const FieldLabel('Date'),
        PickerField(
          icon: PhosphorIconsRegular.calendarBlank,
          label: _date == null ? 'Pick a date' : BdTime.shortDate(BdTime.fromWall(_date!.year, _date!.month, _date!.day, 12, 0)),
          placeholder: _date == null,
          onTap: () async {
            final now = DateTime.now();
            final d = await showDatePicker(
              context: context,
              initialDate: _date ?? now,
              firstDate: DateTime(now.year - 1),
              lastDate: DateTime(now.year + 2),
            );
            if (d != null) setState(() => _date = d);
          },
        ),
        const FieldLabel('Start time'),
        PickerField(
          icon: PhosphorIconsRegular.clock,
          label: _time.format(context),
          onTap: () async {
            final t = await showTimePicker(context: context, initialTime: _time);
            if (t != null) setState(() => _time = t);
          },
        ),
        const FieldLabel('Theme'),
        TextField(controller: _theme, maxLength: 120, decoration: const InputDecoration(hintText: 'e.g. Cross-Cultural Conversations', counterText: '')),
      ],
    );
  }
}
