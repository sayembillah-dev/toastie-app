import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../ui/widgets.dart';
import 'meetings_screen.dart' show PickerField;

/// At a glance + readiness (PRD §7.3).
class OverviewScreen extends ConsumerWidget {
  const OverviewScreen({super.key, required this.meetingId});
  final String meetingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final meeting = ref.watch(meetingProvider(meetingId));
    final roles = ref.watch(meetingRolesProvider(meetingId)).value ?? const <RoleAssignment>[];
    final speakers = ref.watch(speakersProvider(meetingId)).value ?? const <PreparedSpeaker>[];
    final people = ref.watch(peopleProvider).value;
    final canEdit = ref.watch(canProvider)(Act.update, 'meeting');

    return Scaffold(
      appBar: AppBar(title: const Text('Overview')),
      body: AsyncBody<Meeting>(
        value: meeting,
        builder: (m) {
          final defs = buildRoles(m).where((d) => !d.optional).toList();
          final filled = defs.where((d) => roles.any((r) => r.roleKey == d.key && r.filled)).length;
          final prepared = speakers.where((s) => !s.isKeynote).toList();
          final detailsDone = speakers.isNotEmpty &&
              speakers.every((s) => s.hasSpeaker && s.title.trim().isNotEmpty && (s.isKeynote || s.project != null));
          final checks = [
            ('Roles assigned', '$filled/${defs.length}', filled == defs.length),
            ('Theme & word of the day', m.word.isEmpty ? 'Word not set' : m.word.word,
                m.theme.trim().isNotEmpty && !m.word.isEmpty),
            ('Speakers booked', '${prepared.length.clamp(0, targetSpeakers)}/$targetSpeakers', prepared.length >= targetSpeakers),
            ('Speech details filled', detailsDone ? 'All set' : 'Missing details', detailsDone),
          ];
          final allDone = checks.every((x) => x.$3);
          String nameFor(String key) {
            final r = roles.where((r) => r.roleKey == key).firstOrNull;
            return people?.name(membershipId: r?.membershipId, guestId: r?.guestId) ?? '—';
          }

          return ListView(padding: const EdgeInsets.only(bottom: 32), children: [
            const SectionLabel('At a glance', padding: EdgeInsets.fromLTRB(16, 8, 16, 8)),
            AppCard(
              child: Row(children: [
                _fact(t, 'No.', '#${m.meetingNumber}'),
                _fact(t, 'Date', BdTime.date(m.dateTime)),
                _fact(t, 'Time', BdTime.time(m.dateTime)),
                if (canEdit)
                  IconButton(
                    tooltip: 'Edit meeting number, date and time',
                    icon: const Icon(PhosphorIconsRegular.pencilSimple),
                    onPressed: () => _editDetails(context, ref, m),
                  ),
              ]),
            ),
            const SectionLabel('Meeting readiness'),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final x in checks)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(children: [
                      Icon(x.$3 ? PhosphorIconsFill.checkCircle : PhosphorIconsRegular.circle,
                          size: 20, color: x.$3 ? c.success : c.inkMuted),
                      const SizedBox(width: 10),
                      Expanded(child: Text(x.$1, style: t.bodyMedium)),
                      Text(x.$2, style: t.bodySmall),
                    ]),
                  ),
                if (allDone)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('Everything is set — this agenda is ready to publish.',
                        style: TextStyle(color: c.success, fontWeight: FontWeight.w600)),
                  ),
              ]),
            ),
            const SectionLabel('Who'),
            GroupCard(children: [
              RowTile(dense: true, title: toastmasterLabel(m.dateTime), trailing: Text(nameFor('toastmaster'))),
              RowTile(dense: true, title: 'General Evaluator', trailing: Text(nameFor('general-evaluator'))),
              RowTile(dense: true, title: 'Table Topic Master', trailing: Text(nameFor('table-topic-master'))),
            ]),
            const SectionLabel('Speech lineup'),
            if (speakers.isEmpty)
              AppCard(child: Text('No speakers booked yet.', style: t.bodySmall))
            else
              GroupCard(children: [
                for (final s in speakers)
                  RowTile(
                    dense: true,
                    title: '${s.isKeynote ? 'Keynote: ' : '${s.order}. '}${s.title.isEmpty ? 'Untitled speech' : s.title}',
                    subtitle: [
                      people?.name(membershipId: s.membershipId, guestId: s.guestId) ?? 'No speaker',
                      if (s.duration != null) '${s.duration} min',
                    ].join(' · '),
                  ),
              ]),
            const SectionLabel('Word of the day'),
            AppCard(
              child: m.word.isEmpty
                  ? Text('Not set yet — the Theme card feeds this and the agenda.', style: t.bodySmall)
                  : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(m.word.word, style: t.titleLarge),
                      if (m.word.partOfSpeech.isNotEmpty) Text(m.word.partOfSpeech, style: t.bodySmall),
                      if (m.word.meaning.isNotEmpty) ...[const SizedBox(height: 6), Text(m.word.meaning)],
                    ]),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: OutlinedButton.icon(
                onPressed: () => context.push('/meetings/${m.id}/agenda'),
                icon: const Icon(PhosphorIconsRegular.listBullets, size: 18),
                label: const Text('View agenda'),
              ),
            ),
          ]);
        },
      ),
    );
  }

  Widget _fact(TextTheme t, String label, String value) => Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(), style: t.labelSmall),
          const SizedBox(height: 2),
          Text(value, style: t.titleMedium),
        ]),
      );

  Future<void> _editDetails(BuildContext context, WidgetRef ref, Meeting m) async {
    await showFormSheet<void>(context, builder: (ctx) => _EditDetailsForm(meeting: m));
  }
}

class _EditDetailsForm extends ConsumerStatefulWidget {
  const _EditDetailsForm({required this.meeting});
  final Meeting meeting;
  @override
  ConsumerState<_EditDetailsForm> createState() => _EditDetailsFormState();
}

class _EditDetailsFormState extends ConsumerState<_EditDetailsForm> {
  late final _number = TextEditingController(text: '${widget.meeting.meetingNumber}');
  late DateTime _date;
  late TimeOfDay _time;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final w = BdTime.wall(widget.meeting.dateTime);
    _date = DateTime(w.year, w.month, w.day);
    _time = TimeOfDay(hour: w.hour, minute: w.minute);
  }

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final n = int.tryParse(_number.text);
    if (n == null || n < 1) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).updateMeeting(widget.meeting.id, {
        'meetingNumber': n,
        'dateTime': BdTime.fromWall(_date.year, _date.month, _date.day, _time.hour, _time.minute).toIso8601String(),
      });
      HapticFeedback.mediumImpact();
      ref.invalidate(meetingProvider(widget.meeting.id));
      ref.invalidate(meetingsProvider);
      if (!mounted) return;
      showToast(context, 'Meeting details updated');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SheetScaffold(
      title: 'Edit meeting details',
      primaryLabel: 'Save',
      busy: _busy,
      onPrimary: _save,
      children: [
        const FieldLabel('Meeting number'),
        TextField(
          controller: _number,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        ),
        const FieldLabel('Date'),
        PickerField(
          icon: PhosphorIconsRegular.calendarBlank,
          label: BdTime.shortDate(BdTime.fromWall(_date.year, _date.month, _date.day, 12, 0)),
          onTap: () async {
            final d = await showDatePicker(
              context: context,
              initialDate: _date,
              firstDate: DateTime(_date.year - 2),
              lastDate: DateTime(_date.year + 2),
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
      ],
    );
  }
}
