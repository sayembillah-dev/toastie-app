import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';
import 'live_common.dart';
import 'role_state.dart';

/// Grammarian live tool (PRD §7.8): Word-of-the-Day usage tallies and a
/// "what was said → what it should be" log.
class GrammarianScreen extends ConsumerStatefulWidget {
  const GrammarianScreen({super.key, required this.meetingId, this.token});
  final String meetingId;
  final String? token;
  @override
  ConsumerState<GrammarianScreen> createState() => _GrammarianScreenState();
}

class _GrammarianScreenState extends ConsumerState<GrammarianScreen> {
  late final RoleStateController<GrammarianState> _ctl = RoleStateController<GrammarianState>(
    api: ref.read(apiProvider),
    meetingId: widget.meetingId,
    kind: 'grammarian',
    fromJson: GrammarianState.fromJson,
    toJson: (s) => s.toJson(),
    empty: GrammarianState.empty(),
    token: widget.token,
  )..start();
  final _said = TextEditingController();
  final _corrected = TextEditingController();
  final _saidFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _ctl.addListener(_onState);
  }

  void _onState() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _ctl.removeListener(_onState);
    _ctl.dispose();
    _said.dispose();
    _corrected.dispose();
    _saidFocus.dispose();
    super.dispose();
  }

  void _log() {
    final said = _said.text.trim();
    if (said.isEmpty) return;
    HapticFeedback.lightImpact();
    _ctl.update((s) => s.copyWith(entries: [
          GrammarianEntry({
            'id': newId(),
            'said': said,
            'corrected': _corrected.text.trim(),
            'createdAt': DateTime.now().millisecondsSinceEpoch,
          }),
          ...s.entries,
        ]));
    _said.clear();
    _corrected.clear();
    _saidFocus.requestFocus();
  }

  Future<void> _addWotdPerson() async {
    final p = await pickPerson(context, title: 'Add person');
    if (p == null) return;
    _ctl.update((s) => s.copyWith(wotdSpeakers: [
          ...s.wotdSpeakers,
          WotdSpeaker({'id': newId(), 'memberId': ?p.memberId, 'guestId': ?p.guestId, 'name': p.name, 'count': 0}),
        ]));
  }

  void _bump(WotdSpeaker w, int d) {
    HapticFeedback.lightImpact();
    _ctl.update((s) => s.copyWith(wotdSpeakers: [
          for (final x in s.wotdSpeakers) x.id == w.id ? x.copyWith({'count': (x.count + d).clamp(0, 999)}) : x,
        ]));
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final meeting = ref.watch(meetingProvider(widget.meetingId)).value;
    final word = meeting?.word;
    final state = _ctl.state;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Grammarian'),
        actions: [
          SyncDot(offline: _ctl.offline),
          if (widget.token == null) ShareRoleAction(meetingId: widget.meetingId, role: 'grammarian', label: 'Grammarian'),
        ],
      ),
      body: !_ctl.loaded
          ? const SkeletonList(count: 4)
          : ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.only(bottom: 40),
              children: [
                const SectionLabel('Word of the day', padding: EdgeInsets.fromLTRB(16, 8, 16, 8)),
                AppCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (word == null || word.isEmpty)
                      Text('No word set — add one on the meeting’s Theme card.', style: t.bodySmall)
                    else ...[
                      Text(word.word, style: t.headlineMedium),
                      if (word.meaning.isNotEmpty) Text(word.meaning, style: t.bodySmall),
                    ],
                    const SizedBox(height: 12),
                    for (final w in state.wotdSpeakers)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(children: [
                          Expanded(child: Text(w.name, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w500))),
                          IconButton.outlined(
                            tooltip: 'One less',
                            onPressed: w.count > 0 ? () => _bump(w, -1) : null,
                            icon: const Icon(PhosphorIconsBold.minus, size: 16),
                          ),
                          SizedBox(
                            width: 44,
                            child: Text('${w.count}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                          ),
                          IconButton.filled(
                            tooltip: 'Used the word',
                            onPressed: () => _bump(w, 1),
                            icon: const Icon(PhosphorIconsBold.plus, size: 16),
                          ),
                        ]),
                      ),
                    TextButton.icon(
                      onPressed: _addWotdPerson,
                      icon: const Icon(PhosphorIconsRegular.userPlus, size: 18),
                      label: const Text('Add person'),
                    ),
                  ]),
                ),
                const SectionLabel('Grammarian log'),
                AppCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    TextField(
                      controller: _said,
                      focusNode: _saidFocus,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(hintText: 'What was said'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _corrected,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _log(),
                      decoration: const InputDecoration(hintText: 'What it should be'),
                    ),
                    const SizedBox(height: 10),
                    FilledButton.icon(
                      onPressed: _log,
                      icon: const Icon(PhosphorIconsBold.plus, size: 16),
                      label: const Text('Add to log'),
                    ),
                  ]),
                ),
                const SizedBox(height: 8),
                if (state.entries.isEmpty)
                  const EmptyState(
                    icon: PhosphorIconsRegular.textAa,
                    title: 'No mistakes logged yet',
                    message: 'Every entry you add lands at the top of this list with its time.',
                  )
                else
                  for (final e in state.entries)
                    Dismissible(
                      key: ValueKey(e.id),
                      direction: DismissDirection.endToStart,
                      background: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 24),
                        color: c.dangerSoft,
                        child: Icon(PhosphorIconsRegular.trash, color: c.danger),
                      ),
                      onDismissed: (_) =>
                          _ctl.update((s) => s.copyWith(entries: s.entries.where((x) => x.id != e.id).toList())),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        child: AppCard(
                          margin: EdgeInsets.zero,
                          padding: const EdgeInsets.all(12),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(e.said,
                                    style: TextStyle(
                                        decoration: TextDecoration.lineThrough, color: c.danger, fontSize: 15)),
                                if (e.corrected.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(e.corrected, style: TextStyle(color: c.success, fontSize: 15, fontWeight: FontWeight.w500)),
                                ],
                              ]),
                            ),
                            Text(
                              DateFormat('h:mm a').format(BdTime.wall(DateTime.fromMillisecondsSinceEpoch(e.createdAt, isUtc: true))),
                              style: t.bodySmall,
                            ),
                          ]),
                        ),
                      ),
                    ),
              ],
            ),
    );
  }
}
