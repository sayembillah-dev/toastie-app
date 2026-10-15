import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';
import 'meeting_common.dart';

enum _Seg { current, upcoming, past }

class MeetingsScreen extends ConsumerStatefulWidget {
  const MeetingsScreen({super.key});
  @override
  ConsumerState<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends ConsumerState<MeetingsScreen> {
  _Seg _seg = _Seg.current;

  @override
  Widget build(BuildContext context) {
    final can = ref.watch(canProvider);
    if (!can(Act.read, 'meeting')) return const AccessRestricted(title: 'Meetings');
    final meetings = ref.watch(meetingsProvider);
    final banner = parseHexColor(ref.watch(clubProvider).value?.bannerColor);
    final canCreate = can(Act.create, 'meeting');
    final c = AppColors.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Meetings'),
        actions: [
          if (can(Act.read, 'education'))
            TextButton.icon(
              onPressed: () => context.push('/meetings/planner'),
              icon: const Icon(PhosphorIconsRegular.calendarPlus, size: 18),
              label: const Text('Planner'),
            ),
        ],
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton(
              tooltip: 'New meeting',
              onPressed: () => showNewMeetingSheet(context, ref),
              child: const Icon(PhosphorIconsBold.plus),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(meetingsProvider.future),
        child: AsyncBody<List<Meeting>>(
          value: meetings,
          onRetry: () => ref.invalidate(meetingsProvider),
          loading: const SkeletonList(count: 3, height: 180),
          builder: (list) {
            final now = DateTime.now().toUtc();
            final p = MeetingPartition.of(list, now);
            final items = switch (_seg) {
              _Seg.current => p.current == null ? <Meeting>[] : [p.current!],
              _Seg.upcoming => p.upcoming.skip(1).toList(),
              _Seg.past => p.past,
            };
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: SegmentedButton<_Seg>(
                    showSelectedIcon: false,
                    segments: [
                      const ButtonSegment(value: _Seg.current, label: Text('Current')),
                      ButtonSegment(value: _Seg.upcoming, label: Text('Upcoming (${(p.upcoming.length - 1).clamp(0, 999)})')),
                      ButtonSegment(value: _Seg.past, label: Text('Past (${p.past.length})')),
                    ],
                    selected: {_seg},
                    onSelectionChanged: (s) {
                      HapticFeedback.selectionClick();
                      setState(() => _seg = s.first);
                    },
                  ),
                ),
                if (_seg == _Seg.current && p.current != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 2),
                    child: Row(children: [
                      Pill(
                        p.current!.isLive(now)
                            ? 'Happening now'
                            : 'Next up${BdTime.relativeDay(p.current!.dateTime, now) == null ? '' : ' · ${BdTime.relativeDay(p.current!.dateTime, now)}'}',
                        icon: PhosphorIconsRegular.calendarCheck,
                        color: c.ink,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(BdTime.longDate(p.current!.dateTime),
                            overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
                      ),
                    ]),
                  ),
                if (items.isEmpty)
                  EmptyState(
                    icon: PhosphorIconsRegular.calendarBlank,
                    title: switch (_seg) {
                      _Seg.current => 'No upcoming meeting',
                      _Seg.upcoming => 'Nothing else scheduled',
                      _Seg.past => 'No past meetings yet',
                    },
                    action: canCreate && _seg != _Seg.past
                        ? FilledButton(onPressed: () => showNewMeetingSheet(context, ref), child: const Text('Create new meeting'))
                        : null,
                  ),
                for (final m in items)
                  MeetingCard(
                    meeting: m,
                    bannerColor: banner,
                    onTap: () => context.push('/meetings/${m.id}'),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// New meeting sheet (PRD §7.1).
Future<void> showNewMeetingSheet(BuildContext context, WidgetRef ref) async {
  final list = ref.read(meetingsProvider).value ?? const <Meeting>[];
  final next = list.fold<int>(0, (a, m) => m.meetingNumber > a ? m.meetingNumber : a) + 1;
  final created = await showFormSheet<Meeting>(
    context,
    builder: (ctx) => _NewMeetingForm(nextNumber: next),
  );
  if (created != null && context.mounted) {
    showToast(context, 'Meeting #${created.meetingNumber} created');
    context.push('/meetings/${created.id}');
  }
}

class _NewMeetingForm extends ConsumerStatefulWidget {
  const _NewMeetingForm({required this.nextNumber});
  final int nextNumber;
  @override
  ConsumerState<_NewMeetingForm> createState() => _NewMeetingFormState();
}

class _NewMeetingFormState extends ConsumerState<_NewMeetingForm> {
  final _form = GlobalKey<FormState>();
  late final _number = TextEditingController(text: '${widget.nextNumber}');
  final _theme = TextEditingController();
  DateTime? _date; // Bangladesh calendar date
  TimeOfDay _time = const TimeOfDay(hour: 19, minute: 0);
  bool _busy = false;
  String? _dateError;

  @override
  void dispose() {
    _number.dispose();
    _theme.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _dateError = _date == null ? 'Pick a meeting date' : null);
    if (!_form.currentState!.validate() || _date == null) return;
    setState(() => _busy = true);
    try {
      final instant = BdTime.fromWall(_date!.year, _date!.month, _date!.day, _time.hour, _time.minute);
      final m = await ref.read(apiProvider).createMeeting(
            number: int.parse(_number.text),
            dateTime: instant,
            theme: _theme.text.trim(),
          );
      ref.invalidate(meetingsProvider);
      if (mounted) Navigator.pop(context, m);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    String dateLabel() {
      if (_date == null) return 'Pick a date';
      return BdTime.shortDate(BdTime.fromWall(_date!.year, _date!.month, _date!.day, 12, 0));
    }

    return Form(
      key: _form,
      child: SheetScaffold(
        title: 'New meeting',
        primaryLabel: 'Create meeting',
        busy: _busy,
        onPrimary: _submit,
        children: [
          Row(children: [
            SizedBox(
              width: 96,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const FieldLabel('Number'),
                TextFormField(
                  controller: _number,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  validator: (v) => (int.tryParse(v ?? '') ?? 0) < 1 ? 'Required' : null,
                ),
              ]),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const FieldLabel('Theme'),
                TextFormField(
                  controller: _theme,
                  maxLength: 120,
                  textCapitalization: TextCapitalization.words,
                  validator: (v) => (v ?? '').trim().isEmpty ? 'Give the meeting a theme' : null,
                  decoration: const InputDecoration(hintText: 'e.g. Cross-Cultural Conversations', counterText: ''),
                ),
              ]),
            ),
          ]),
          const FieldLabel('Date'),
          _PickerField(
            icon: PhosphorIconsRegular.calendarBlank,
            label: dateLabel(),
            placeholder: _date == null,
            error: _dateError,
            onTap: () async {
              final today = BdTime.wall(DateTime.now());
              final d = await showDatePicker(
                context: context,
                initialDate: _date ?? DateTime(today.year, today.month, today.day),
                firstDate: DateTime(today.year - 1),
                lastDate: DateTime(today.year + 2),
              );
              if (d != null) setState(() => _date = d);
            },
          ),
          const FieldLabel('Start time'),
          _PickerField(
            icon: PhosphorIconsRegular.clock,
            label: _time.format(context),
            onTap: () async {
              final t = await showTimePicker(context: context, initialTime: _time);
              if (t != null) setState(() => _time = t);
            },
          ),
          const SizedBox(height: 8),
          Text('Times are Bangladesh time.', style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
        ],
      ),
    );
  }
}

class _PickerField extends StatelessWidget {
  const _PickerField({super.key, required this.icon, required this.label, required this.onTap, this.placeholder = false, this.error});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool placeholder;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.control),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            border: Border.all(color: error != null ? c.danger : c.line),
            borderRadius: BorderRadius.circular(Radii.control),
          ),
          child: Row(children: [
            Icon(icon, size: 20, color: c.inkSoft),
            const SizedBox(width: 10),
            Text(label, style: TextStyle(fontSize: 16, color: placeholder ? c.inkMuted : c.ink)),
          ]),
        ),
      ),
      if (error != null)
        Padding(
          padding: const EdgeInsets.only(top: 6, left: 12),
          child: Text(error!, style: TextStyle(color: c.danger, fontSize: 12)),
        ),
    ]);
  }
}

/// Reusable date/time picker row for other forms.
class PickerField extends _PickerField {
  const PickerField({super.key, required super.icon, required super.label, required super.onTap, super.placeholder, super.error});
}
