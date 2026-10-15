import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import '../live/live_common.dart';
import 'meeting_common.dart';

final voteCandidatesProvider = FutureProvider.family<List<VoteCategory>, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).voteCandidates(id);
});

final voteResultsProvider = FutureProvider.family<VoteResults, String>((ref, id) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).voteResults(id);
});

/// Voting (PRD §7.12): contestants per category, live results, and the
/// ballot link the room scans.
class VotingScreen extends ConsumerStatefulWidget {
  const VotingScreen({super.key, required this.meetingId});
  final String meetingId;
  @override
  ConsumerState<VotingScreen> createState() => _VotingScreenState();
}

class _VotingScreenState extends ConsumerState<VotingScreen> {
  int _tab = 0;
  bool _syncing = false;

  String get _id => widget.meetingId;

  Future<void> _sync() async {
    setState(() => _syncing = true);
    try {
      await ref.read(apiProvider).syncVoteCandidates(_id);
      HapticFeedback.mediumImpact();
      ref.invalidate(voteCandidatesProvider(_id));
      if (mounted) showToast(context, 'Candidates synced from the meeting');
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _save(VoteCategory cat, List<VoteCandidate> next) async {
    try {
      await ref.read(apiProvider).setVoteCandidates(_id, cat.key, next);
      ref.invalidate(voteCandidatesProvider(_id));
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  Future<void> _add(VoteCategory cat) async {
    final p = await pickPerson(context, title: 'Add a candidate');
    if (p == null) return;
    await _save(cat, [
      ...cat.candidates,
      VoteCandidate(id: '', name: p.name, membershipId: p.memberId, guestId: p.guestId),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final meeting = ref.watch(meetingProvider(_id)).value;
    final canEdit = ref.watch(canProvider)(Act.update, 'meeting');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Voting'),
        actions: [
          if (meeting != null)
            IconButton(
              tooltip: 'Voting link',
              icon: const Icon(PhosphorIconsRegular.qrCode),
              onPressed: () => showQrSheet(
                context,
                title: 'Voting link',
                helper: 'Everyone in the room scans this to vote. Ballots are anonymous — one pick per question.',
                url: MeetingLinks.vote(meeting),
              ),
            ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: SizedBox(
            width: double.infinity,
            child: SegmentedButton<int>(
              showSelectedIcon: false,
              segments: const [ButtonSegment(value: 0, label: Text('Contestants')), ButtonSegment(value: 1, label: Text('Results'))],
              selected: {_tab},
              onSelectionChanged: (s) {
                HapticFeedback.selectionClick();
                setState(() => _tab = s.first);
                if (s.first == 1) ref.invalidate(voteResultsProvider(_id));
              },
            ),
          ),
        ),
        Expanded(child: _tab == 0 ? _contestants(canEdit) : _results(canEdit)),
      ]),
    );
  }

  Widget _contestants(bool canEdit) {
    final c = AppColors.of(context);
    final cats = ref.watch(voteCandidatesProvider(_id));
    return RefreshIndicator(
      onRefresh: () => ref.refresh(voteCandidatesProvider(_id).future),
      child: AsyncBody<List<VoteCategory>>(
        value: cats,
        onRetry: () => ref.invalidate(voteCandidatesProvider(_id)),
        builder: (list) => ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 40), children: [
          if (canEdit)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: OutlinedButton.icon(
                onPressed: _syncing ? null : _sync,
                icon: _syncing
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(PhosphorIconsRegular.arrowsClockwise, size: 18),
                label: const Text('Sync from meeting data'),
              ),
            ),
          for (final cat in list) ...[
            SectionLabel(cat.label),
            AppCard(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(cat.question, style: Theme.of(context).textTheme.bodySmall),
                if (cat.isAuto)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Add Table Topics speakers here as they speak.', style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
                  ),
                const SizedBox(height: 6),
                if (cat.candidates.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text('No options on this ballot yet.', style: TextStyle(color: c.inkMuted)),
                  ),
                for (final cand in cat.candidates)
                  Row(children: [
                    Avatar(name: cand.name, size: 28),
                    const SizedBox(width: 10),
                    Expanded(child: Text('${cand.name}${cand.guestId != null ? ' (Guest)' : ''}')),
                    if (canEdit)
                      IconButton(
                        tooltip: 'Remove ${cand.name}',
                        icon: Icon(PhosphorIconsRegular.x, size: 18, color: c.inkMuted),
                        onPressed: () => _save(cat, cat.candidates.where((x) => x != cand).toList()),
                      ),
                  ]),
                if (canEdit)
                  TextButton.icon(
                    onPressed: () => _add(cat),
                    icon: const Icon(PhosphorIconsRegular.plus, size: 16),
                    label: const Text('Add a candidate'),
                  ),
              ]),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _results(bool canEdit) {
    final c = AppColors.of(context);
    final results = ref.watch(voteResultsProvider(_id));
    return RefreshIndicator(
      onRefresh: () => ref.refresh(voteResultsProvider(_id).future),
      child: AsyncBody<VoteResults>(
        value: results,
        onRetry: () => ref.invalidate(voteResultsProvider(_id)),
        builder: (r) => ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 40), children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: Text('${r.totalBallots} ballot${r.totalBallots == 1 ? '' : 's'} · pull to refresh',
                style: Theme.of(context).textTheme.bodySmall),
          ),
          for (final cat in r.categories) ...[
            SectionLabel(
              cat.label,
              trailing: canEdit && cat.totalVotes > 0
                  ? GestureDetector(
                      onTap: () async {
                        final ok = await confirmDialog(context,
                            title: 'Clear ${cat.label}?',
                            message: 'Every pick in this category is wiped. Candidates stay on the ballot.',
                            confirmLabel: 'Clear',
                            destructive: true);
                        if (!ok) return;
                        await ref.read(apiProvider).clearVoteCategory(_id, cat.key).catchError((_) {});
                        ref.invalidate(voteResultsProvider(_id));
                      },
                      child: Text('Clear', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.danger)),
                    )
                  : null,
            ),
            AppCard(
              child: cat.candidates.isEmpty
                  ? Text('No votes yet.', style: Theme.of(context).textTheme.bodySmall)
                  : Column(children: [
                      for (var i = 0; i < cat.candidates.length; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              if (i == 0 && cat.candidates[i].votes > 0) ...[
                                Icon(PhosphorIconsFill.trophy, size: 16, color: c.warning),
                                const SizedBox(width: 6),
                              ],
                              Expanded(
                                child: Text(cat.candidates[i].name,
                                    style: TextStyle(fontWeight: i == 0 ? FontWeight.w600 : FontWeight.w400)),
                              ),
                              Text('${cat.candidates[i].votes}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            ]),
                            const SizedBox(height: 4),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: cat.totalVotes == 0 ? 0 : cat.candidates[i].votes / cat.totalVotes,
                                minHeight: 8,
                                backgroundColor: c.fill,
                                color: i == 0 ? c.ink : c.inkMuted,
                              ),
                            ),
                          ]),
                        ),
                    ]),
            ),
          ],
        ]),
      ),
    );
  }
}
