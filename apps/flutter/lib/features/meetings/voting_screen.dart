import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import '../live/live_common.dart';
import 'meeting_common.dart';

final voteSetupProvider = FutureProvider.family<VoteSetup, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).voteSetup(id);
});

final voteResultsProvider = FutureProvider.family<VoteResults, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).voteResults(id);
});

/* Ballots arrive through the anonymous public link, so nothing on this
 * device knows when one lands — the vote count polls while voting is open. */
const _livePoll = Duration(seconds: 5);

/// Voting (PRD §7.12) as three steps: put people on the ballot, open voting
/// (QR in front of the room, link optionally sent on WhatsApp), then close
/// and show the winners. Results stay hidden while voting is open so the
/// room isn't swayed by who's ahead.
class VotingScreen extends ConsumerStatefulWidget {
  const VotingScreen({super.key, required this.meetingId});
  final String meetingId;
  @override
  ConsumerState<VotingScreen> createState() => _VotingScreenState();
}

class _VotingScreenState extends ConsumerState<VotingScreen> {
  bool _busy = false;
  bool _notifyWhatsapp = true;
  bool _showTallies = false;
  Timer? _poll;

  String get _id => widget.meetingId;

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  /// Polls the tally only while voting is open; any other state stops it.
  void _syncPolling(VotingState state) {
    if (state == VotingState.open) {
      _poll ??= Timer.periodic(_livePoll, (_) {
        if (mounted) ref.invalidate(voteResultsProvider(_id));
      });
    } else {
      _poll?.cancel();
      _poll = null;
    }
  }

  void _refreshAll() {
    ref.invalidate(voteSetupProvider(_id));
    ref.invalidate(voteResultsProvider(_id));
  }

  Future<void> _run(Future<void> Function() work) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await work();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _start(VotingStatus status) => _run(() async {
        final notify = _notifyWhatsapp && _canSendWhatsapp(status);
        final r = await ref.read(apiProvider).openVoting(_id, notifyWhatsapp: notify);
        HapticFeedback.mediumImpact();
        _refreshAll();
        if (!mounted) return;
        showToast(
          context,
          r.whatsappQueued > 0
              ? 'Voting is open — sending the link to ${_people(r.whatsappQueued)} on WhatsApp'
              : 'Voting is open',
        );
      });

  Future<void> _reopen() => _run(() async {
        await ref.read(apiProvider).openVoting(_id);
        _refreshAll();
        if (mounted) showToast(context, 'Voting is open again');
      });

  Future<void> _close() => _run(() async {
        await ref.read(apiProvider).closeVoting(_id);
        HapticFeedback.mediumImpact();
        setState(() => _showTallies = false);
        _refreshAll();
      });

  Future<void> _clearVotes(VoteResults results) async {
    final withVotes = results.categories.where((c) => c.totalVotes > 0).toList();
    if (withVotes.isEmpty) {
      showToast(context, 'There are no votes to clear');
      return;
    }
    await showActionSheet(context, title: 'Clear votes for…', actions: [
      for (final cat in withVotes)
        SheetAction(
          icon: PhosphorIconsRegular.eraser,
          label: cat.label,
          subtitle: _votes(cat.totalVotes),
          destructive: true,
          onTap: () async {
            final ok = await confirmDialog(
              context,
              title: 'Clear ${cat.label}?',
              message: 'Every vote for this award is wiped. The names stay on the ballot.',
              confirmLabel: 'Clear',
              destructive: true,
            );
            if (!ok) return;
            await _run(() async {
              await ref.read(apiProvider).clearVoteCategory(_id, cat.key);
              ref.invalidate(voteResultsProvider(_id));
              if (mounted) showToast(context, 'Votes cleared for ${cat.label}');
            });
          },
        ),
    ]);
  }

  void _showMenu(Meeting? meeting, VotingStatus status, bool canEdit) {
    final results = ref.read(voteResultsProvider(_id)).value;
    showActionSheet(context, actions: [
      if (meeting != null)
        SheetAction(
          icon: PhosphorIconsRegular.qrCode,
          label: 'Show voting QR code',
          onTap: () => _showQr(meeting),
        ),
      if (canEdit && status.state == VotingState.closed)
        SheetAction(
          icon: PhosphorIconsRegular.arrowCounterClockwise,
          label: 'Reopen voting',
          onTap: _reopen,
        ),
      if (canEdit && results != null)
        SheetAction(
          icon: PhosphorIconsRegular.eraser,
          label: 'Clear votes…',
          destructive: true,
          onTap: () => _clearVotes(results),
        ),
    ]);
  }

  void _showQr(Meeting meeting) => showQrSheet(
        context,
        title: 'Scan to vote',
        helper: 'Anonymous · one pick per award',
        url: MeetingLinks.vote(meeting),
      );

  @override
  Widget build(BuildContext context) {
    final meeting = ref.watch(meetingProvider(_id)).value;
    final canEdit = ref.watch(canProvider)(Act.update, 'meeting');
    final setup = ref.watch(voteSetupProvider(_id));
    final results = ref.watch(voteResultsProvider(_id));

    /* The setup read is the authority on state. If the polled tally reports
     * a different one (another officer pressed Close), re-read setup. */
    final status = setup.value?.status;
    final polled = results.value?.status;
    if (status != null && polled != null && polled.state != status.state && !setup.isLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.invalidate(voteSetupProvider(_id));
      });
    }
    if (status != null) _syncPolling(status.state);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Voting'),
        actions: [
          if (status != null && (meeting != null || canEdit))
            IconButton(
              tooltip: 'More',
              icon: const Icon(PhosphorIconsBold.dotsThreeVertical),
              onPressed: () => _showMenu(meeting, status, canEdit),
            ),
        ],
      ),
      body: AsyncBody<VoteSetup>(
        value: setup,
        onRetry: _refreshAll,
        builder: (s) => Column(children: [
          _StepStrip(state: s.status.state),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                _refreshAll();
                await ref.read(voteSetupProvider(_id).future);
              },
              child: switch (s.status.state) {
                VotingState.setup => _setupBody(s, canEdit),
                VotingState.open => _openBody(s, meeting, results.value, canEdit),
                VotingState.closed => _closedBody(results, meeting),
              },
            ),
          ),
        ]),
      ),
      bottomNavigationBar: status == null ? null : _bottomBar(status, canEdit, meeting, results.value),
    );
  }

  // ───────────────────────── Step 1 · Candidates ─────────────────────────

  Widget _setupBody(VoteSetup s, bool canEdit) {
    final t = Theme.of(context).textTheme;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text("Who's on the ballot?", style: t.titleLarge),
            const SizedBox(height: 4),
            Text(
              canEdit ? 'Tap an award to change names.' : "Voting hasn't started yet.",
              style: t.bodySmall,
            ),
          ]),
        ),
        ..._awardRows(s.categories, canEdit),
      ],
    );
  }

  List<Widget> _awardRows(List<VoteCategory> categories, bool canEdit) => [
        for (final cat in categories)
          _AwardRow(
            category: cat,
            onTap: canEdit ? () => _editCategory(cat.key) : null,
          ),
      ];

  Future<void> _editCategory(String key) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => _CategoryEditor(meetingId: _id, categoryKey: key),
      );

  bool _canSendWhatsapp(VotingStatus s) =>
      s.whatsappAvailable && s.linkSentAt == null && s.whatsappRecipients > 0;

  Widget? _whatsappOption(VotingStatus s) {
    if (!s.whatsappAvailable) return null;
    final c = AppColors.of(context);
    final muted = TextStyle(fontSize: 13.5, color: c.inkSoft);
    if (s.linkSentAt != null) {
      return Row(children: [
        Icon(PhosphorIconsRegular.checkCircle, size: 18, color: c.success),
        const SizedBox(width: 8),
        Expanded(child: Text('Voting link already sent on WhatsApp', style: muted)),
      ]);
    }
    if (s.whatsappRecipients == 0) {
      return Row(children: [
        Icon(PhosphorIconsRegular.whatsappLogo, size: 18, color: c.inkMuted),
        const SizedBox(width: 8),
        Expanded(child: Text('No one checked in has a WhatsApp number yet', style: muted)),
      ]);
    }
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => setState(() => _notifyWhatsapp = !_notifyWhatsapp),
      child: Row(children: [
        SizedBox(
          width: 32,
          height: 32,
          child: Checkbox(
            value: _notifyWhatsapp,
            onChanged: (v) => setState(() => _notifyWhatsapp = v ?? false),
          ),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            'Also send the link on WhatsApp to ${_people(s.whatsappRecipients)} here',
            style: TextStyle(fontSize: 13.5, color: c.ink),
          ),
        ),
      ]),
    );
  }

  // ───────────────────────── Step 2 · Vote ─────────────────────────

  Widget _openBody(VoteSetup s, Meeting? meeting, VoteResults? results, bool canEdit) {
    final c = AppColors.of(context);
    final ballots = results?.totalBallots;
    final status = results?.status ?? s.status;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        _QrCard(meeting: meeting, onFullScreen: meeting == null ? null : () => _showQr(meeting)),
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 20, Space.gutter, 0),
          child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: c.success, shape: BoxShape.circle)),
            const SizedBox(width: 10),
            Text(
              ballots == null ? '–' : '$ballots',
              style: TextStyle(fontSize: 34, fontWeight: FontWeight.w700, color: c.ink, letterSpacing: -0.5),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                ballots == 1 ? 'person has voted' : 'people have voted',
                style: TextStyle(fontSize: 16, color: c.inkSoft),
              ),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 0),
          child: Text(
            'Updates live. Results stay hidden until you close voting.',
            style: TextStyle(fontSize: 13, color: c.inkSoft),
          ),
        ),
        if (_deliveryText(status) case final text?)
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 0),
            child: Row(children: [
              Icon(PhosphorIconsRegular.whatsappLogo, size: 16, color: c.inkSoft),
              const SizedBox(width: 6),
              Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: c.inkSoft))),
            ]),
          ),
        if (canEdit) ...[
          const SectionLabel('On the ballot'),
          ..._awardRows(s.categories, true),
        ],
      ],
    );
  }

  String? _deliveryText(VotingStatus s) {
    final d = s.delivery;
    if (d != null) {
      final failed = d.failed > 0 ? ' · ${d.failed} failed' : '';
      return d.sent + d.failed >= d.queued
          ? 'Link sent to ${d.sent} of ${d.queued} on WhatsApp$failed'
          : 'Sending link on WhatsApp: ${d.sent} of ${d.queued}$failed';
    }
    return s.linkSentAt != null ? 'Voting link sent on WhatsApp' : null;
  }

  // ───────────────────────── Step 3 · Winners ─────────────────────────

  Widget _closedBody(AsyncValue<VoteResults> results, Meeting? meeting) {
    final t = Theme.of(context).textTheme;
    return AsyncBody<VoteResults>(
      value: results,
      onRetry: () => ref.invalidate(voteResultsProvider(_id)),
      builder: (r) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
              Expanded(child: Text('Winners', style: t.titleLarge)),
              Text('${r.totalBallots} ballot${r.totalBallots == 1 ? '' : 's'}', style: t.bodySmall),
            ]),
          ),
          for (final cat in r.categories) ...[
            _WinnerCard(category: cat),
            const SizedBox(height: 10),
          ],
          Center(
            child: TextButton.icon(
              onPressed: () => setState(() => _showTallies = !_showTallies),
              icon: Icon(_showTallies ? PhosphorIconsBold.caretUp : PhosphorIconsBold.caretDown, size: 16),
              label: Text(_showTallies ? 'Hide vote counts' : 'See all vote counts'),
            ),
          ),
          if (_showTallies)
            for (final cat in r.categories) ...[
              SectionLabel(cat.label, trailing: Text(_votes(cat.totalVotes), style: t.bodySmall)),
              _TallyCard(category: cat),
            ],
        ],
      ),
    );
  }

  // ───────────────────────── Bottom bar ─────────────────────────

  Widget? _bottomBar(VotingStatus status, bool canEdit, Meeting? meeting, VoteResults? results) {
    final c = AppColors.of(context);
    final spinner = const SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
    );
    final List<Widget> children;
    switch (status.state) {
      case VotingState.setup:
        if (!canEdit) return null;
        children = [
          if (_whatsappOption(status) case final option?) ...[option, const SizedBox(height: 10)],
          FilledButton.icon(
            onPressed: _busy ? null : () => _start(status),
            icon: _busy ? spinner : const Icon(PhosphorIconsRegular.qrCode, size: 20),
            label: const Text('Start voting'),
          ),
        ];
      case VotingState.open:
        if (!canEdit) return null;
        children = [
          FilledButton.icon(
            onPressed: _busy ? null : _close,
            icon: _busy ? spinner : const Icon(PhosphorIconsRegular.trophy, size: 20),
            label: const Text('Close voting & show winners'),
          ),
        ];
      case VotingState.closed:
        if (results == null) return null;
        children = [
          Row(children: [
            if (canEdit) ...[
              OutlinedButton(onPressed: _busy ? null : _reopen, child: const Text('Reopen')),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: FilledButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  fullscreenDialog: true,
                  builder: (_) => _PresentWinners(results: results, meeting: meeting),
                )),
                icon: const Icon(PhosphorIconsRegular.trophy, size: 20),
                label: const Text('Present winners'),
              ),
            ),
          ]),
        ];
    }
    return Container(
      decoration: BoxDecoration(color: c.canvas, border: Border(top: BorderSide(color: c.line))),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 12),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        ),
      ),
    );
  }
}

String _people(int n) => n == 1 ? '1 person' : '$n people';
String _votes(int n) => n == 1 ? '1 vote' : '$n votes';

/// The candidates tied at the top, provided anyone has a vote.
List<String> _winners(VoteResultCategory cat) {
  if (cat.candidates.isEmpty) return const [];
  final top = cat.candidates.map((c) => c.votes).reduce((a, b) => a > b ? a : b);
  if (top == 0) return const [];
  return [for (final c in cat.candidates) if (c.votes == top) c.name];
}

int _topVotes(VoteResultCategory cat) =>
    cat.candidates.isEmpty ? 0 : cat.candidates.map((c) => c.votes).reduce((a, b) => a > b ? a : b);

// ───────────────────────── Pieces ─────────────────────────

class _StepStrip extends StatelessWidget {
  const _StepStrip({required this.state});
  final VotingState state;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final current = state.index;
    Widget step(int i, String label) {
      final done = i < current;
      final active = i == current;
      return Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done ? c.successSoft : (active ? c.ink : c.fill),
          ),
          child: done
              ? Icon(PhosphorIconsBold.check, size: 12, color: c.success)
              : Text('${i + 1}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: active ? c.canvas : c.inkSoft)),
        ),
        const SizedBox(width: 6),
        Text(label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: active ? FontWeight.w600 : FontWeight.w400,
              color: active ? c.ink : c.inkSoft,
            )),
      ]);
    }

    Widget line(int i) => Expanded(
          child: Container(
            height: 2,
            margin: const EdgeInsets.symmetric(horizontal: 8),
            color: i < current ? c.ink : c.line,
          ),
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 16),
      child: Row(children: [
        step(0, 'Candidates'),
        line(0),
        step(1, 'Vote'),
        line(1),
        step(2, 'Winners'),
      ]),
    );
  }
}

class _AwardRow extends StatelessWidget {
  const _AwardRow({required this.category, this.onTap});
  final VoteCategory category;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final people = category.candidates;
    final empty = people.isEmpty;
    final shown = people.take(3).toList();
    final more = people.length - shown.length;

    final content = Row(children: [
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(category.label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.ink)),
          const SizedBox(height: 8),
          if (empty)
            Row(children: [
              Icon(PhosphorIconsBold.plus, size: 14, color: c.warning),
              const SizedBox(width: 6),
              Text('Add names', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.warning)),
            ])
          else
            Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 6, children: [
              SizedBox(
                height: 28,
                width: 28.0 + (shown.length - 1 + (more > 0 ? 1 : 0)) * 20,
                child: Stack(children: [
                  for (var i = 0; i < shown.length; i++)
                    Positioned(
                      left: i * 20.0,
                      child: Container(
                        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.canvas, width: 2)),
                        child: Avatar(name: shown[i].name, size: 24),
                      ),
                    ),
                  if (more > 0)
                    Positioned(
                      left: shown.length * 20.0,
                      child: Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: c.fill,
                          border: Border.all(color: c.canvas, width: 2),
                        ),
                        child: Text('+$more',
                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: c.inkSoft)),
                      ),
                    ),
                ]),
              ),
              Text(_people(people.length), style: TextStyle(fontSize: 13, color: c.inkSoft)),
              if (category.isAuto)
                Pill('From Timer', icon: PhosphorIconsRegular.timer, color: c.success, background: c.successSoft),
            ]),
        ]),
      ),
      if (onTap != null) Icon(PhosphorIconsRegular.caretRight, size: 18, color: c.inkMuted),
    ]);

    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 10),
      child: Material(
        color: empty ? c.warningSoft : c.canvas,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.card),
          side: BorderSide(color: empty ? c.warning.withValues(alpha: 0.5) : c.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: const EdgeInsets.fromLTRB(14, 12, 12, 12), child: content),
        ),
      ),
    );
  }
}

/// One award's names: remove with ×, add with the person picker. Reads the
/// live setup so it reflects each save straight away.
class _CategoryEditor extends ConsumerStatefulWidget {
  const _CategoryEditor({required this.meetingId, required this.categoryKey});
  final String meetingId;
  final String categoryKey;
  @override
  ConsumerState<_CategoryEditor> createState() => _CategoryEditorState();
}

class _CategoryEditorState extends ConsumerState<_CategoryEditor> {
  bool _saving = false;

  Future<void> _save(List<VoteCandidate> next) async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(apiProvider).setVoteCandidates(widget.meetingId, widget.categoryKey, next);
      ref.invalidate(voteSetupProvider(widget.meetingId));
      ref.invalidate(voteResultsProvider(widget.meetingId));
      await ref.read(voteSetupProvider(widget.meetingId).future);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _add(VoteCategory cat) async {
    final p = await pickPerson(context, title: 'Add to ${cat.label}');
    if (p == null) return;
    final taken = cat.candidates.any((x) =>
        (p.memberId != null && x.membershipId == p.memberId) ||
        (p.guestId != null && x.guestId == p.guestId) ||
        x.name.trim().toLowerCase() == p.name.trim().toLowerCase());
    if (taken) {
      if (mounted) showToast(context, '${p.name} is already on this award');
      return;
    }
    await _save([
      ...cat.candidates,
      VoteCandidate(id: '', name: p.name, membershipId: p.memberId, guestId: p.guestId),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final setup = ref.watch(voteSetupProvider(widget.meetingId)).value;
    final cat = setup?.categories.where((x) => x.key == widget.categoryKey).firstOrNull;

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
        child: cat == null
            ? const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
            : Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 8),
                  child: Row(children: [
                    Expanded(child: Text(cat.label, style: t.titleMedium)),
                    if (_saving) const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  ]),
                ),
                if (cat.isAuto)
                  Container(
                    margin: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: c.successSoft, borderRadius: BorderRadius.circular(Radii.control)),
                    child: Row(children: [
                      Icon(PhosphorIconsRegular.timer, size: 18, color: c.success),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text('Names appear here as the Timer adds speakers.',
                            style: TextStyle(fontSize: 13.5, color: c.success)),
                      ),
                    ]),
                  ),
                Flexible(
                  child: ListView(shrinkWrap: true, padding: const EdgeInsets.symmetric(horizontal: Space.gutter), children: [
                    if (cat.candidates.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text('No one on this award yet.', style: TextStyle(color: c.inkSoft)),
                      ),
                    for (final cand in cat.candidates)
                      Container(
                        height: 56,
                        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.line))),
                        child: Row(children: [
                          Avatar(name: cand.name, size: 34),
                          const SizedBox(width: 12),
                          Expanded(child: Text(cand.name, style: const TextStyle(fontSize: 16))),
                          if (cand.guestId != null) const Pill('Guest'),
                          IconButton(
                            tooltip: 'Remove ${cand.name}',
                            icon: Icon(PhosphorIconsRegular.x, size: 18, color: c.inkSoft),
                            onPressed: _saving
                                ? null
                                : () => _save(cat.candidates.where((x) => x.id != cand.id).toList()),
                          ),
                        ]),
                      ),
                    TextButton.icon(
                      style: TextButton.styleFrom(alignment: Alignment.centerLeft, minimumSize: const Size.fromHeight(52)),
                      onPressed: _saving ? null : () => _add(cat),
                      icon: const Icon(PhosphorIconsRegular.plus, size: 18),
                      label: const Text('Add person'),
                    ),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(Space.gutter, 8, Space.gutter, 12),
                  child: FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Done')),
                ),
              ]),
      ),
    );
  }
}

class _QrCard extends StatelessWidget {
  const _QrCard({required this.meeting, required this.onFullScreen});
  final Meeting? meeting;
  final VoidCallback? onFullScreen;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final url = meeting == null ? null : MeetingLinks.vote(meeting!);
    final outline = OutlinedButton.styleFrom(
      foregroundColor: Colors.white,
      side: const BorderSide(color: Color(0xFF44557A)),
      minimumSize: const Size.fromHeight(44),
    );
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: Space.gutter),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: c.heroEnd, borderRadius: BorderRadius.circular(Radii.sheet)),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
          child: url == null
              ? const SizedBox(width: 180, height: 180, child: Center(child: CircularProgressIndicator()))
              : QrImageView(data: url, size: 180, backgroundColor: Colors.white),
        ),
        const SizedBox(height: 14),
        const Text('Scan to vote', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Anonymous · one pick per award', style: TextStyle(color: Color(0xFFC9D2E3), fontSize: 14)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: Builder(
              builder: (ctx) => OutlinedButton.icon(
                style: outline,
                onPressed: url == null ? null : () => shareText(ctx, url),
                icon: const Icon(PhosphorIconsRegular.shareNetwork, size: 16),
                label: const Text('Share link'),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              style: outline,
              onPressed: onFullScreen,
              icon: const Icon(PhosphorIconsRegular.qrCode, size: 16),
              label: const Text('Full screen'),
            ),
          ),
        ]),
      ]),
    );
  }
}

class _WinnerCard extends StatelessWidget {
  const _WinnerCard({required this.category});
  final VoteResultCategory category;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final winners = _winners(category);
    final top = _topVotes(category);
    final tie = winners.length > 1;
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: winners.isEmpty ? c.fill : c.warningSoft, shape: BoxShape.circle),
          child: Icon(PhosphorIconsRegular.trophy, size: 22, color: winners.isEmpty ? c.inkMuted : c.warning),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(category.label.toUpperCase(),
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, letterSpacing: 0.4, color: c.inkSoft)),
            const SizedBox(height: 2),
            Text(
              winners.isEmpty ? 'No votes' : winners.join(' & '),
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: winners.isEmpty ? c.inkMuted : c.ink,
              ),
            ),
            if (tie) ...[const SizedBox(height: 4), const Pill('Tie')],
          ]),
        ),
        if (winners.isNotEmpty)
          Text(tie ? '$top each' : _votes(top),
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.inkSoft)),
      ]),
    );
  }
}

class _TallyCard extends StatelessWidget {
  const _TallyCard({required this.category});
  final VoteResultCategory category;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final top = _topVotes(category);
    return AppCard(
      child: category.candidates.isEmpty
          ? Text('No one was on this award.', style: Theme.of(context).textTheme.bodySmall)
          : Column(children: [
              for (final cand in category.candidates)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(
                        child: Text(cand.name,
                            style: TextStyle(fontWeight: top > 0 && cand.votes == top ? FontWeight.w600 : FontWeight.w400)),
                      ),
                      Text('${cand.votes}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    ]),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: category.totalVotes == 0 ? 0 : cand.votes / category.totalVotes,
                        minHeight: 8,
                        backgroundColor: c.fill,
                        color: top > 0 && cand.votes == top ? c.ink : c.inkMuted,
                      ),
                    ),
                  ]),
                ),
            ]),
    );
  }
}

/// Full-screen winners for reading out or holding up to the room.
class _PresentWinners extends StatelessWidget {
  const _PresentWinners({required this.results, required this.meeting});
  final VoteResults results;
  final Meeting? meeting;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Scaffold(
      backgroundColor: c.heroEnd,
      appBar: AppBar(
        backgroundColor: c.heroEnd,
        foregroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: Text(meeting == null ? 'Winners' : 'Meeting #${meeting!.meetingNumber} winners'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        children: [
          for (final cat in results.categories)
            Padding(
              padding: const EdgeInsets.only(bottom: 28),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(cat.label.toUpperCase(),
                    style: const TextStyle(
                        color: Color(0xFFC9D2E3), fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
                const SizedBox(height: 6),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Icon(PhosphorIconsFill.trophy, size: 26, color: c.mint),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _winners(cat).isEmpty ? 'No votes' : _winners(cat).join(' & '),
                      style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w700, height: 1.15),
                    ),
                  ),
                ]),
              ]),
            ),
        ],
      ),
    );
  }
}
