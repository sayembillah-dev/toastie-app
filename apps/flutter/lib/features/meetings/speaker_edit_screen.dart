import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../domain/pathways.dart';
import '../../ui/widgets.dart';
import 'meeting_common.dart';

/// Edit one speaker slot (PRD §7.5). Changes save with the button at the
/// bottom; confirming a speech messages the speaker server-side.
class SpeakerEditScreen extends ConsumerStatefulWidget {
  const SpeakerEditScreen({super.key, required this.meetingId, required this.speakerId});
  final String meetingId;
  final String speakerId;
  @override
  ConsumerState<SpeakerEditScreen> createState() => _SpeakerEditScreenState();
}

class _SpeakerEditScreenState extends ConsumerState<SpeakerEditScreen> {
  PreparedSpeaker? _orig;
  Assignee? _speaker;
  Assignee? _evaluator;
  final _title = TextEditingController();
  final _duration = TextEditingController();
  final _notes = TextEditingController();
  String? _pathway;
  String? _project;
  String _status = 'requested';
  bool _busy = false;
  bool _dirty = false;

  @override
  void dispose() {
    _title.dispose();
    _duration.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _hydrate(PreparedSpeaker s, People? p) {
    if (_orig != null) return;
    _orig = s;
    _speaker = p?.assignee(membershipId: s.membershipId, guestId: s.guestId);
    _evaluator = p?.assignee(membershipId: s.evaluatorMembershipId, guestId: s.evaluatorGuestId);
    _title.text = s.title;
    _duration.text = s.duration?.toString() ?? '';
    _notes.text = s.notes ?? '';
    _pathway = s.pathway;
    _project = s.project;
    _status = s.status;
  }

  void _touch() => setState(() => _dirty = true);

  /// Clear the dirty flag, then pop once PopScope has rebuilt with
  /// `canPop: true` — popping in the same frame would re-trigger the prompt.
  void _leave() {
    setState(() => _dirty = false);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.pop();
    });
  }

  Future<void> _save() async {
    final s = _orig!;
    final duration = int.tryParse(_duration.text.trim());
    if (_duration.text.trim().isNotEmpty && (duration == null || duration < 1 || duration > 120)) {
      showToast(context, 'Duration must be between 1 and 120 minutes', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).updateSpeaker(widget.meetingId, s.id, {
        'status': _status,
        'membershipId': _speaker != null && !_speaker!.isGuest ? _speaker!.id : null,
        'guestId': _speaker != null && _speaker!.isGuest ? _speaker!.id : null,
        if (!s.isKeynote) 'evaluatorMembershipId': _evaluator != null && !_evaluator!.isGuest ? _evaluator!.id : null,
        if (!s.isKeynote) 'evaluatorGuestId': _evaluator != null && _evaluator!.isGuest ? _evaluator!.id : null,
        'title': _title.text.trim(),
        'duration': duration,
        'pathway': _pathway,
        'project': _project,
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      });
      HapticFeedback.mediumImpact();
      ref.invalidate(speakersProvider(widget.meetingId));
      if (!mounted) return;
      showToast(context, 'Speaker saved');
      _leave();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final ok = await confirmDialog(context,
        title: 'Remove this speaker?', confirmLabel: 'Remove', destructive: true,
        message: 'The slot and its details are deleted from the agenda.');
    if (!ok) return;
    try {
      await ref.read(apiProvider).deleteSpeaker(widget.meetingId, widget.speakerId);
      ref.invalidate(speakersProvider(widget.meetingId));
      if (!mounted) return;
      _leave();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final speakers = ref.watch(speakersProvider(widget.meetingId));
    final people = ref.watch(peopleProvider).value;
    final catalog = ref.watch(pathwayCatalogProvider).value;
    final meeting = ref.watch(meetingProvider(widget.meetingId)).value;
    final canEdit = ref.watch(canProvider)(Act.update, 'meeting');

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await confirmDialog(context,
            title: 'Discard changes?', confirmLabel: 'Discard', destructive: true,
            message: 'Your edits to this speaker have not been saved.');
        if (leave && context.mounted) _leave();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Speaker'),
          actions: [
            if (meeting != null && _orig != null && !_orig!.isKeynote)
              IconButton(
                tooltip: 'Show evaluation QR',
                icon: const Icon(PhosphorIconsRegular.qrCode),
                onPressed: () => showQrSheet(
                  context,
                  title: 'Evaluation link',
                  helper: 'Scan with a phone camera to open the evaluation form.',
                  url: MeetingLinks.evaluate(meeting, widget.speakerId),
                ),
              ),
            if (canEdit)
              IconButton(
                tooltip: 'Remove speaker',
                icon: Icon(PhosphorIconsRegular.trash, color: c.danger),
                onPressed: _delete,
              ),
          ],
        ),
        bottomNavigationBar: canEdit
            ? SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: FilledButton(
                    onPressed: _busy || !_dirty ? null : _save,
                    child: _busy
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                        : const Text('Save speaker'),
                  ),
                ),
              )
            : null,
        body: AsyncBody<List<PreparedSpeaker>>(
          value: speakers,
          builder: (list) {
            final s = list.where((x) => x.id == widget.speakerId).firstOrNull;
            if (s == null) {
              return const EmptyState(icon: PhosphorIconsRegular.microphoneSlash, title: 'This speaker was removed');
            }
            // Wait for names: hydrating without them would load an empty
            // speaker/evaluator, and saving would then clear the real ones.
            if (people == null) return const SkeletonList(count: 4, height: 56);
            _hydrate(s, people);
            final pathway = catalog?.byName(_pathway);
            final projects = pathway?.allProjects ?? const <PathwayProject>[];

            return AbsorbPointer(
              absorbing: !canEdit,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  if (s.isKeynote)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 4),
                      decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(10)),
                      child: Text('A keynote is not evaluated — just set who is speaking, the title and the time.',
                          style: TextStyle(fontSize: 13.5, color: c.inkSoft)),
                    ),
                  const FieldLabel('Status'),
                  SegmentedButton<String>(
                    showSelectedIcon: false,
                    segments: [
                      for (final e in speakerStatuses.entries) ButtonSegment(value: e.key, label: Text(e.value)),
                    ],
                    selected: {_status},
                    onSelectionChanged: (v) {
                      _status = v.first;
                      _touch();
                    },
                  ),
                  const FieldLabel('Speaker'),
                  _AssigneeField(
                    value: _speaker,
                    placeholder: 'Select a speaker',
                    onTap: () async {
                      final r = await pickAssignee(context, title: 'Speaker', current: _speaker);
                      if (r == null) return;
                      _speaker = r.assignee;
                      _touch();
                    },
                  ),
                  const FieldLabel('Speech title'),
                  TextField(
                    controller: _title,
                    maxLength: 120,
                    onChanged: (_) => _touch(),
                    decoration: const InputDecoration(hintText: 'e.g. The fear of becoming yourself', counterText: ''),
                  ),
                  const FieldLabel('Pathway', optional: true),
                  _SelectField(
                    value: _pathway == null ? null : '${_pathway!} (${pathway?.abbrev ?? ''})',
                    placeholder: 'Select a pathway',
                    onTap: catalog == null
                        ? null
                        : () async {
                            final p = await _pickFromList(context, 'Pathway', [for (final p in catalog.pathways) p.name]);
                            if (p == null) return;
                            setState(() {
                              if (p != _pathway) _project = null;
                              _pathway = p == '' ? null : p;
                            });
                            _touch();
                          },
                  ),
                  const FieldLabel('Project', optional: true),
                  _SelectField(
                    value: _project == null
                        ? null
                        : (() {
                            final pr = pathway?.findProject(_project);
                            return pr == null ? _project! : 'L${pr.level} · ${pr.name}';
                          })(),
                    placeholder: _pathway == null ? 'Pick a pathway first' : 'Select a project',
                    onTap: projects.isEmpty
                        ? null
                        : () async {
                            final picked = await _pickFromList(
                              context,
                              'Project',
                              [for (final p in projects) p.name],
                              labels: {for (final p in projects) p.name: 'L${p.level} · ${p.name}${p.elective ? ' (elective)' : ''}'},
                            );
                            if (picked == null) return;
                            setState(() {
                              _project = picked == '' ? null : picked;
                              final range = pathway?.findProject(_project)?.range;
                              if (range != null) _duration.text = '${range.max}';
                            });
                            _touch();
                          },
                  ),
                  const FieldLabel('Duration (min)'),
                  TextField(
                    controller: _duration,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
                    onChanged: (_) => _touch(),
                    decoration: InputDecoration(
                      hintText: 'e.g. 7',
                      helperText: pathway?.findProject(_project)?.speechTime == null
                          ? null
                          : 'Set by project: ${pathway!.findProject(_project)!.speechTime}',
                    ),
                  ),
                  if (!s.isKeynote) ...[
                    const FieldLabel('Evaluator'),
                    _AssigneeField(
                      value: _evaluator,
                      placeholder: 'Select evaluator',
                      onTap: () async {
                        final r = await pickAssignee(context, title: 'Evaluator', current: _evaluator);
                        if (r == null) return;
                        _evaluator = r.assignee;
                        _touch();
                      },
                    ),
                  ],
                  const FieldLabel('Notes', optional: true),
                  TextField(
                    controller: _notes,
                    maxLines: 3,
                    minLines: 2,
                    onChanged: (_) => _touch(),
                    decoration: const InputDecoration(hintText: 'e.g. Using presentation software'),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

Future<String?> _pickFromList(BuildContext context, String title, List<String> values, {Map<String, String>? labels}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (ctx, scroll) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 12, 8),
          child: Row(children: [
            Expanded(child: Text(title, style: Theme.of(ctx).textTheme.titleLarge)),
            TextButton(onPressed: () => Navigator.pop(ctx, ''), child: const Text('Clear')),
          ]),
        ),
        Expanded(
          child: ListView(controller: scroll, children: [
            for (final v in values)
              ListTile(title: Text(labels?[v] ?? v), onTap: () => Navigator.pop(ctx, v)),
          ]),
        ),
      ]),
    ),
  );
}

class _AssigneeField extends StatelessWidget {
  const _AssigneeField({required this.value, required this.placeholder, required this.onTap});
  final Assignee? value;
  final String placeholder;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.control),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(border: Border.all(color: c.line), borderRadius: BorderRadius.circular(Radii.control)),
        child: Row(children: [
          if (value != null) Avatar(name: value!.name, size: 30) else Icon(PhosphorIconsRegular.userPlus, color: c.inkMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value == null ? placeholder : '${value!.name}${value!.isGuest ? ' (Guest)' : ''}',
              style: TextStyle(fontSize: 16, color: value == null ? c.inkMuted : c.ink),
            ),
          ),
          const Chevron(),
        ]),
      ),
    );
  }
}

class _SelectField extends StatelessWidget {
  const _SelectField({required this.value, required this.placeholder, this.onTap});
  final String? value;
  final String placeholder;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.control),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(border: Border.all(color: c.line), borderRadius: BorderRadius.circular(Radii.control)),
        child: Row(children: [
          Expanded(
            child: Text(value ?? placeholder,
                style: TextStyle(fontSize: 16, color: value == null ? c.inkMuted : c.ink)),
          ),
          Icon(PhosphorIconsRegular.caretDown, size: 16, color: onTap == null ? c.line : c.inkMuted),
        ]),
      ),
    );
  }
}
