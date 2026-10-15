import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../app/session.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';
import 'live_common.dart';
import 'role_state.dart';

/// Ah-Counter live tool (PRD §7.7). One speaker at a time; a big tile per
/// filler word — tap = +1, long-press = −1. Swipe between speakers.
class AhCounterScreen extends ConsumerStatefulWidget {
  const AhCounterScreen({super.key, required this.meetingId, this.token});
  final String meetingId;
  final String? token;
  @override
  ConsumerState<AhCounterScreen> createState() => _AhCounterScreenState();
}

class _AhCounterScreenState extends ConsumerState<AhCounterScreen> {
  late final RoleStateController<AhState> _ctl = RoleStateController<AhState>(
    api: ref.read(apiProvider),
    meetingId: widget.meetingId,
    kind: 'ah-counter',
    fromJson: AhState.fromJson,
    toJson: (s) => s.toJson(),
    empty: AhState.empty(),
    token: widget.token,
  )..start();
  int? _open; // index of the speaker being counted

  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
    _ctl.addListener(_onState);
  }

  void _onState() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _ctl.removeListener(_onState);
    _ctl.dispose();
    WakelockPlus.disable();
    super.dispose();
  }

  Future<void> _add() async {
    final p = await pickPerson(context, title: 'Add speaker');
    if (p == null) return;
    _ctl.update((s) => s.copyWith(speakers: [
          ...s.speakers,
          AhSpeaker({
            'id': newId(),
            'memberId': ?p.memberId,
            'guestId': ?p.guestId,
            'name': p.name,
            'counts': <String, int>{},
            'expanded': false,
          }),
        ]));
  }

  Future<void> _takeFromAgenda() async {
    try {
      final sources = await loadAgendaSources(ref, widget.meetingId);
      if (sources.isEmpty) {
        if (mounted) showToast(context, 'No speakers or evaluators on the agenda yet');
        return;
      }
      _ctl.update((s) {
        final rows = mergeAgenda(s.speakers.map((x) => x.raw).toList(), sources, (src, existing) => {
              ...?existing,
              'id': existing?['id'] ?? newId(),
              'memberId': src.memberId,
              'guestId': src.guestId,
              'name': src.name,
              'counts': existing?['counts'] ?? <String, int>{},
              'expanded': existing?['expanded'] ?? false,
              'agendaKey': src.agendaKey,
            });
        return s.copyWith(speakers: rows.map(AhSpeaker.new).toList());
      });
      HapticFeedback.mediumImpact();
      if (mounted) showToast(context, 'Speakers taken from the agenda');
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  void _addMenu() => showActionSheet(context, actions: [
        SheetAction(icon: PhosphorIconsRegular.listChecks, label: 'Take from agenda', onTap: _takeFromAgenda),
        SheetAction(icon: PhosphorIconsRegular.userPlus, label: 'Add speaker', onTap: _add),
      ]);

  Future<void> _manageWords() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: _WordsEditor(controller: _ctl),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final state = _ctl.state;
    final cats = state.categories;

    if (_open != null && _open! < state.speakers.length) {
      return _CountingView(
        controller: _ctl,
        initial: _open!,
        onClose: () => setState(() => _open = null),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ah Counter'),
        actions: [
          SyncDot(offline: _ctl.offline),
          IconButton(tooltip: 'Filler words', icon: const Icon(PhosphorIconsRegular.textAa), onPressed: _manageWords),
          if (widget.token == null) ShareRoleAction(meetingId: widget.meetingId, role: 'ah-counter', label: 'Ah Counter'),
        ],
      ),
      floatingActionButton: state.speakers.isEmpty
          ? null
          : FloatingActionButton(tooltip: 'Add speaker', onPressed: _addMenu, child: const Icon(PhosphorIconsBold.plus)),
      body: !_ctl.loaded
          ? const SkeletonList(count: 4)
          : state.speakers.isEmpty
              ? Center(
                  child: EmptyState(
                    icon: PhosphorIconsRegular.speakerHigh,
                    title: 'No speakers yet',
                    message: 'Pull everyone from the agenda, or add a speaker by name to start counting.',
                    action: Column(children: [
                      FilledButton.icon(
                        onPressed: _takeFromAgenda,
                        icon: const Icon(PhosphorIconsRegular.listChecks, size: 18),
                        label: const Text('Take from agenda'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: _add, child: const Text('Add speaker')),
                    ]),
                  ),
                )
              : ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 100), children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('Counting ${cats.join(' · ')} · tap a speaker to count',
                        style: Theme.of(context).textTheme.bodySmall),
                  ),
                  for (var i = 0; i < state.speakers.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: AppCard(
                        margin: EdgeInsets.zero,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() => _open = i);
                        },
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(state.speakers[i].name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Wrap(spacing: 6, runSpacing: 4, children: [
                                for (final cat in cats)
                                  if ((state.speakers[i].counts[cat] ?? 0) > 0)
                                    Pill('$cat ${state.speakers[i].counts[cat]}'),
                              ]),
                            ]),
                          ),
                          Column(children: [
                            Text('${state.speakers[i].total(cats)}',
                                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: c.ink)),
                            Text('total', style: TextStyle(fontSize: 11.5, color: c.inkMuted)),
                          ]),
                          IconButton(
                            tooltip: 'Remove',
                            icon: Icon(PhosphorIconsRegular.x, size: 18, color: c.inkMuted),
                            onPressed: () async {
                              final ok = await confirmDialog(context,
                                  title: 'Remove ${state.speakers[i].name}?',
                                  message: 'Their counts are deleted.',
                                  confirmLabel: 'Remove',
                                  destructive: true);
                              if (!ok) return;
                              final id = state.speakers[i].id;
                              _ctl.update((s) => s.copyWith(speakers: s.speakers.where((x) => x.id != id).toList()));
                            },
                          ),
                        ]),
                      ),
                    ),
                ]),
    );
  }
}

class _CountingView extends StatefulWidget {
  const _CountingView({required this.controller, required this.initial, required this.onClose});
  final RoleStateController<AhState> controller;
  final int initial;
  final VoidCallback onClose;
  @override
  State<_CountingView> createState() => _CountingViewState();
}

class _CountingViewState extends State<_CountingView> {
  late final PageController _pages = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final state = widget.controller.state;
    final speakers = state.speakers;
    final cats = state.categories;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onClose();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(icon: const Icon(PhosphorIconsBold.caretLeft), tooltip: 'All speakers', onPressed: widget.onClose),
          title: Text('${_index + 1} of ${speakers.length}'),
          actions: [SyncDot(offline: widget.controller.offline)],
        ),
        body: PageView.builder(
          controller: _pages,
          itemCount: speakers.length,
          onPageChanged: (i) {
            HapticFeedback.selectionClick();
            setState(() => _index = i);
          },
          itemBuilder: (context, i) {
            final s = speakers[i];
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(children: [
                  Text(s.name, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 4),
                  Text('${s.total(cats)} filler${s.total(cats) == 1 ? '' : 's'} · tap to add, hold to subtract',
                      style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 16),
                  Expanded(
                    child: GridView.count(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.1,
                      children: [
                        for (final cat in cats)
                          _CountTile(
                            label: cat,
                            count: s.counts[cat] ?? 0,
                            onInc: () {
                              HapticFeedback.lightImpact();
                              widget.controller.update((st) => st.bump(s.id, cat, 1));
                            },
                            onDec: () {
                              HapticFeedback.mediumImpact();
                              widget.controller.update((st) => st.bump(s.id, cat, -1));
                            },
                          ),
                      ],
                    ),
                  ),
                  if (speakers.length > 1)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        for (var d = 0; d < speakers.length; d++)
                          Container(
                            width: d == _index ? 18 : 6,
                            height: 6,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: BoxDecoration(
                              color: d == _index ? c.ink : c.fillStrong,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                      ]),
                    ),
                ]),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CountTile extends StatelessWidget {
  const _CountTile({required this.label, required this.count, required this.onInc, required this.onDec});
  final String label;
  final int count;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Semantics(
      button: true,
      label: '$label, $count. Tap to add one, long press to subtract one.',
      child: Material(
        color: count > 0 ? c.ink : c.fill,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onInc,
          onLongPress: count > 0 ? onDec : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('$count',
                style: TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: count > 0 ? c.canvas : c.ink,
                )),
            Text(label,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: count > 0 ? c.canvas.withValues(alpha: 0.8) : c.inkSoft,
                )),
          ]),
        ),
      ),
    );
  }
}

class _WordsEditor extends StatefulWidget {
  const _WordsEditor({required this.controller});
  final RoleStateController<AhState> controller;
  @override
  State<_WordsEditor> createState() => _WordsEditorState();
}

class _WordsEditorState extends State<_WordsEditor> {
  final _input = TextEditingController();

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  void _add() {
    final w = _input.text.trim().toUpperCase();
    if (w.isEmpty || widget.controller.state.categories.contains(w)) return;
    widget.controller.update((s) => s.copyWith(categories: [...s.categories, w]));
    _input.clear();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final cats = widget.controller.state.categories;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Filler words', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('Removing a word hides it but keeps the counts already tallied.', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final w in cats)
              InputChip(
                label: Text(w),
                onDeleted: cats.length <= 1
                    ? null
                    : () {
                        widget.controller.update((s) => s.copyWith(categories: s.categories.where((x) => x != w).toList()));
                        setState(() {});
                      },
              ),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _input,
                textCapitalization: TextCapitalization.characters,
                onSubmitted: (_) => _add(),
                decoration: const InputDecoration(hintText: 'e.g. Like'),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _add, style: FilledButton.styleFrom(minimumSize: const Size(64, 50)), child: const Text('Add')),
          ]),
        ]),
      ),
    );
  }
}
