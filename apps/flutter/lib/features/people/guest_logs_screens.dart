import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';

// ───────────────────────── Visit logs ─────────────────────────

class VisitLogsScreen extends ConsumerWidget {
  const VisitLogsScreen({super.key, required this.guestId});
  final String guestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final logs = ref.watch(visitLogsProvider(guestId));
    final meetings = ref.watch(meetingsProvider).value ?? const <Meeting>[];
    final byId = {for (final m in meetings) m.id: m};
    final canEdit = ref.watch(canProvider)(Act.update, 'guestLog');

    return Scaffold(
      appBar: AppBar(title: const Text('Visit logs')),
      floatingActionButton: canEdit
          ? FloatingActionButton(
              tooltip: 'Add visit',
              onPressed: () => _edit(context, ref, null),
              child: const Icon(PhosphorIconsBold.plus),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(visitLogsProvider(guestId).future),
        child: AsyncBody<List<VisitLog>>(
          value: logs,
          onRetry: () => ref.invalidate(visitLogsProvider(guestId)),
          builder: (list) {
            final sorted = [...list]..sort((a, b) {
                final da = byId[a.meetingId]?.dateTime;
                final db = byId[b.meetingId]?.dateTime;
                if (da == null || db == null) return (b.createdAt ?? '').compareTo(a.createdAt ?? '');
                return db.compareTo(da);
              });
            return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 100), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Text('Meetings this guest attended — newest first. Auto entries come from meeting agendas.',
                    style: Theme.of(context).textTheme.bodySmall),
              ),
              if (sorted.isEmpty)
                const EmptyState(icon: PhosphorIconsRegular.calendarX, title: 'No visits yet')
              else
                GroupCard(children: [
                  for (final v in sorted)
                    RowTile(
                      title: byId[v.meetingId] == null
                          ? 'Meeting no longer on file'
                          : 'Meeting #${byId[v.meetingId]!.meetingNumber} · ${BdTime.date(byId[v.meetingId]!.dateTime)}',
                      subtitle: [
                        v.role ?? 'Guest',
                        if (v.notes != null) v.notes!,
                      ].join(' · '),
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        Pill(v.isAuto ? 'Auto' : 'Manual', color: v.isAuto ? c.inkSoft : c.ink),
                        if (v.edited) ...[const SizedBox(width: 4), const Pill('Edited')],
                      ]),
                      onTap: canEdit ? () => _edit(context, ref, v) : null,
                    ),
                ]),
            ]);
          },
        ),
      ),
    );
  }

  Future<void> _edit(BuildContext context, WidgetRef ref, VisitLog? existing) async {
    await showFormSheet<void>(context, builder: (_) => _VisitForm(guestId: guestId, existing: existing));
  }
}

class _VisitForm extends ConsumerStatefulWidget {
  const _VisitForm({required this.guestId, this.existing});
  final String guestId;
  final VisitLog? existing;
  @override
  ConsumerState<_VisitForm> createState() => _VisitFormState();
}

class _VisitFormState extends ConsumerState<_VisitForm> {
  late String? _meetingId = widget.existing?.meetingId;
  late final _role = TextEditingController(text: widget.existing?.role ?? 'Guest');
  late final _notes = TextEditingController(text: widget.existing?.notes ?? '');
  bool _busy = false;

  @override
  void dispose() {
    _role.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_meetingId == null) {
      showToast(context, 'Pick a meeting', error: true);
      return;
    }
    setState(() => _busy = true);
    final api = ref.read(apiProvider);
    final body = {'meetingId': _meetingId, 'role': _role.text.trim(), 'notes': _notes.text.trim()};
    try {
      if (widget.existing == null) {
        await api.createVisitLog(widget.guestId, body);
      } else {
        await api.updateVisitLog(widget.guestId, widget.existing!.id, body);
      }
      ref.invalidate(visitLogsProvider(widget.guestId));
      ref.invalidate(guestProvider(widget.guestId));
      ref.invalidate(guestsProvider);
      if (!mounted) return;
      showToast(context, widget.existing == null ? 'Visit added' : 'Visit updated');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final ok = await confirmDialog(context,
        title: 'Delete this visit?',
        message: 'This removes the visit entry permanently. This action cannot be undone.',
        confirmLabel: 'Delete visit',
        destructive: true);
    if (!ok) return;
    try {
      await ref.read(apiProvider).deleteVisitLog(widget.guestId, widget.existing!.id);
      ref.invalidate(visitLogsProvider(widget.guestId));
      ref.invalidate(guestsProvider);
      if (!mounted) return;
      showToast(context, 'Visit deleted');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final meetings = [...(ref.watch(meetingsProvider).value ?? const <Meeting>[])]
      ..sort((a, b) => b.dateTime.compareTo(a.dateTime));
    final selected = meetings.where((m) => m.id == _meetingId).firstOrNull;
    return SheetScaffold(
      title: widget.existing == null ? 'Add visit' : 'Edit visit',
      primaryLabel: 'Save',
      busy: _busy,
      onPrimary: _save,
      children: [
        const FieldLabel('Which meeting?'),
        InkWell(
          borderRadius: BorderRadius.circular(Radii.control),
          onTap: () async {
            final m = await showModalBottomSheet<Meeting>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              builder: (ctx) => DraggableScrollableSheet(
                expand: false,
                initialChildSize: 0.7,
                builder: (ctx, scroll) => ListView(controller: scroll, children: [
                  for (final m in meetings)
                    ListTile(
                      title: Text('#${m.meetingNumber} · ${m.displayTheme}'),
                      subtitle: Text(BdTime.meeting(m.dateTime)),
                      onTap: () => Navigator.pop(ctx, m),
                    ),
                ]),
              ),
            );
            if (m != null) setState(() => _meetingId = m.id);
          },
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(border: Border.all(color: c.line), borderRadius: BorderRadius.circular(Radii.control)),
            child: Row(children: [
              Expanded(
                child: Text(
                  selected == null ? 'Pick a meeting' : '#${selected.meetingNumber} · ${BdTime.date(selected.dateTime)}',
                  style: TextStyle(fontSize: 16, color: selected == null ? c.inkMuted : c.ink),
                ),
              ),
              const Icon(PhosphorIconsRegular.caretDown, size: 16),
            ]),
          ),
        ),
        const FieldLabel('Role', optional: true),
        TextField(controller: _role, maxLength: VisitLog.roleMax, decoration: const InputDecoration(counterText: '')),
        const FieldLabel('Notes', optional: true),
        TextField(
          controller: _notes,
          maxLines: 3,
          minLines: 2,
          decoration: const InputDecoration(hintText: 'Anything worth remembering about their visit.'),
        ),
        if (widget.existing != null)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: c.danger),
              onPressed: _delete,
              icon: const Icon(PhosphorIconsRegular.trash, size: 18),
              label: const Text('Delete visit'),
            ),
          ),
      ],
    );
  }
}

// ───────────────────────── Contact logs ─────────────────────────

class ContactLogsScreen extends ConsumerWidget {
  const ContactLogsScreen({super.key, required this.guestId});
  final String guestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(contactLogsProvider(guestId));
    final canEdit = ref.watch(canProvider)(Act.update, 'guestLog');

    return Scaffold(
      appBar: AppBar(title: const Text('Contact logs')),
      floatingActionButton: canEdit
          ? FloatingActionButton.extended(
              onPressed: () => showFormSheet<void>(context, builder: (_) => _ContactForm(guestId: guestId)),
              icon: const Icon(PhosphorIconsBold.plus),
              label: const Text('Add log'),
              shape: const StadiumBorder(),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(contactLogsProvider(guestId).future),
        child: AsyncBody<List<ContactLog>>(
          value: logs,
          onRetry: () => ref.invalidate(contactLogsProvider(guestId)),
          builder: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 40),
                EmptyState(
                  icon: PhosphorIconsRegular.chatsCircle,
                  title: 'No contact logs yet',
                  message: 'Tap Add log to note down calls, messages and catch-ups as they happen.',
                ),
              ]);
            }
            return ListView(padding: const EdgeInsets.fromLTRB(0, 4, 0, 100), children: [
              for (final l in list)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AppCard(
                    onTap: canEdit
                        ? () => showFormSheet<void>(context, builder: (_) => _ContactForm(guestId: guestId, existing: l))
                        : null,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Pill(contactMethods[l.method] ?? l.method),
                        const Spacer(),
                        if (l.createdAt != null)
                          Text(BdTime.meeting(DateTime.parse(l.createdAt!)), style: Theme.of(context).textTheme.bodySmall),
                      ]),
                      const SizedBox(height: 8),
                      Text(l.outcome, style: Theme.of(context).textTheme.bodyMedium),
                      if (l.updatedAt != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text('Edited', style: Theme.of(context).textTheme.bodySmall),
                        ),
                    ]),
                  ),
                ),
            ]);
          },
        ),
      ),
    );
  }
}

class _ContactForm extends ConsumerStatefulWidget {
  const _ContactForm({required this.guestId, this.existing});
  final String guestId;
  final ContactLog? existing;
  @override
  ConsumerState<_ContactForm> createState() => _ContactFormState();
}

class _ContactFormState extends ConsumerState<_ContactForm> {
  late String _method = widget.existing?.method ?? 'call';
  late final _outcome = TextEditingController(text: widget.existing?.outcome ?? '');
  bool _busy = false;

  @override
  void dispose() {
    _outcome.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_outcome.text.trim().isEmpty) {
      showToast(context, 'Tell us what happened next', error: true);
      return;
    }
    setState(() => _busy = true);
    final api = ref.read(apiProvider);
    final body = {'method': _method, 'outcome': _outcome.text.trim()};
    try {
      if (widget.existing == null) {
        await api.createContactLog(widget.guestId, body);
      } else {
        await api.updateContactLog(widget.guestId, widget.existing!.id, body);
      }
      ref.invalidate(contactLogsProvider(widget.guestId));
      if (!mounted) return;
      showToast(context, widget.existing == null ? 'Log added' : 'Log updated');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final ok = await confirmDialog(context,
        title: 'Delete this log?',
        message: 'This removes the log entry permanently. This action cannot be undone.',
        confirmLabel: 'Delete log',
        destructive: true);
    if (!ok) return;
    try {
      await ref.read(apiProvider).deleteContactLog(widget.guestId, widget.existing!.id);
      ref.invalidate(contactLogsProvider(widget.guestId));
      if (!mounted) return;
      showToast(context, 'Log deleted');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return SheetScaffold(
      title: widget.existing == null ? 'Add log' : 'Edit log',
      primaryLabel: 'Save',
      busy: _busy,
      onPrimary: _save,
      children: [
        const FieldLabel('How did you reach them?'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final e in contactMethods.entries)
            ChoiceChip(label: Text(e.value), selected: _method == e.key, onSelected: (_) => setState(() => _method = e.key)),
        ]),
        const FieldLabel('What happened next?'),
        TextField(
          controller: _outcome,
          maxLength: ContactLog.outcomeMax,
          maxLines: 5,
          minLines: 3,
          decoration: const InputDecoration(hintText: 'They said they’d come to the next meeting…'),
        ),
        if (widget.existing != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: c.danger),
              onPressed: _delete,
              icon: const Icon(PhosphorIconsRegular.trash, size: 18),
              label: const Text('Delete log'),
            ),
          ),
      ],
    );
  }
}
