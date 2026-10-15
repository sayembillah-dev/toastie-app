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
import '../../ui/widgets.dart';

/// Prepared speakers + keynote (PRD §7.5). Long-press a card to drag it.
class SpeakersScreen extends ConsumerStatefulWidget {
  const SpeakersScreen({super.key, required this.meetingId});
  final String meetingId;
  @override
  ConsumerState<SpeakersScreen> createState() => _SpeakersScreenState();
}

class _SpeakersScreenState extends ConsumerState<SpeakersScreen> {
  List<PreparedSpeaker>? _local; // optimistic order while a reorder saves
  bool _adding = false;

  Future<void> _add(String kind) async {
    setState(() => _adding = true);
    try {
      final s = await ref.read(apiProvider).createSpeaker(widget.meetingId, kind: kind);
      ref.invalidate(speakersProvider(widget.meetingId));
      if (mounted) context.push('/meetings/${widget.meetingId}/speakers/${s.id}');
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _reorder(List<PreparedSpeaker> list, int from, int to) async {
    final next = [...list];
    next.insert(to, next.removeAt(from));
    setState(() => _local = next);
    HapticFeedback.selectionClick();
    try {
      await ref.read(apiProvider).reorderSpeakers(widget.meetingId, next.map((s) => s.id).toList());
      ref.invalidate(speakersProvider(widget.meetingId));
      await ref.read(speakersProvider(widget.meetingId).future);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _local = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final speakers = ref.watch(speakersProvider(widget.meetingId));
    final meeting = ref.watch(meetingProvider(widget.meetingId)).value;
    final people = ref.watch(peopleProvider).value;
    final canEdit = ref.watch(canProvider)(Act.update, 'meeting');

    return Scaffold(
      appBar: AppBar(title: const Text('Prepared speakers')),
      floatingActionButton: canEdit
          ? FloatingActionButton.extended(
              onPressed: _adding
                  ? null
                  : () => showActionSheet(context, actions: [
                        SheetAction(
                          icon: PhosphorIconsRegular.microphoneStage,
                          label: 'Add prepared speaker',
                          onTap: () => _add('prepared'),
                        ),
                        SheetAction(
                          icon: PhosphorIconsRegular.star,
                          label: 'Add keynote',
                          subtitle: 'A keynote is not evaluated',
                          onTap: () => _add('keynote'),
                        ),
                      ]),
              icon: const Icon(PhosphorIconsBold.plus),
              label: const Text('Add speaker'),
              shape: const StadiumBorder(),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(speakersProvider(widget.meetingId).future),
        child: AsyncBody<List<PreparedSpeaker>>(
          value: speakers,
          onRetry: () => ref.invalidate(speakersProvider(widget.meetingId)),
          builder: (fetched) {
            final list = _local ?? fetched;
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 40),
                EmptyState(
                  icon: PhosphorIconsRegular.microphoneStage,
                  title: 'No speakers yet',
                  message: 'Add the first prepared speaker — or a keynote — to get started.',
                ),
              ]);
            }
            final prepared = list.where((s) => !s.isKeynote).length;
            return ReorderableListView.builder(
              padding: const EdgeInsets.only(top: 4, bottom: 120),
              buildDefaultDragHandles: false,
              header: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  '$prepared of $targetSpeakers prepared speakers booked${canEdit && list.length > 1 ? ' · hold the handle to reorder' : ''}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              itemCount: list.length,
              onReorderItem: canEdit ? (a, b) => _reorder(list, a, b) : (_, _) {},
              itemBuilder: (context, i) {
                final s = list[i];
                return Padding(
                  key: ValueKey(s.id),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
                  child: SpeakerCard(
                    speaker: s,
                    index: i,
                    people: people,
                    meeting: meeting,
                    dragHandle: canEdit && list.length > 1
                        ? ReorderableDragStartListener(
                            index: i,
                            child: const Padding(
                              padding: EdgeInsets.all(8),
                              child: Icon(PhosphorIconsRegular.dotsSixVertical, size: 20),
                            ),
                          )
                        : null,
                    onTap: () => context.push('/meetings/${widget.meetingId}/speakers/${s.id}'),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class SpeakerCard extends StatelessWidget {
  const SpeakerCard({
    super.key,
    required this.speaker,
    required this.index,
    required this.people,
    required this.meeting,
    this.dragHandle,
    this.onTap,
  });
  final PreparedSpeaker speaker;
  final int index;
  final People? people;
  final Meeting? meeting;
  final Widget? dragHandle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final s = speaker;
    final speakerName = people?.name(membershipId: s.membershipId, guestId: s.guestId);
    final evaluatorName = people?.name(membershipId: s.evaluatorMembershipId, guestId: s.evaluatorGuestId);
    final statusColor = switch (s.status) {
      'confirmed' => (c.success, c.successSoft),
      'delivered' => (c.ink, c.fill),
      _ => (c.warning, c.warningSoft),
    };
    return Material(
      color: c.canvas,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: c.line)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: s.isKeynote ? c.ink : c.fill, borderRadius: BorderRadius.circular(8)),
              child: s.isKeynote
                  ? Icon(PhosphorIconsFill.star, size: 15, color: c.canvas)
                  : Text('${index + 1}', style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  if (s.isKeynote) ...[const Pill('Keynote'), const SizedBox(width: 6)],
                  Pill(speakerStatuses[s.status] ?? s.status, color: statusColor.$1, background: statusColor.$2),
                ]),
                const SizedBox(height: 6),
                Text(s.title.trim().isEmpty ? 'Untitled speech' : s.title, style: t.titleMedium),
                const SizedBox(height: 2),
                Text(speakerName ?? 'No speaker yet',
                    style: TextStyle(fontSize: 14, color: speakerName == null ? c.inkMuted : c.inkSoft)),
                if (s.pathway != null || s.project != null || s.duration != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      [
                        if (s.pathway != null) s.pathway!,
                        if (s.project != null) s.project!,
                        if (s.duration != null) '${s.duration} min',
                      ].join(' · '),
                      style: t.bodySmall,
                    ),
                  ),
                if (!s.isKeynote)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(children: [
                      Icon(PhosphorIconsRegular.chatCircleText, size: 14, color: c.inkMuted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text('Evaluator: ${evaluatorName ?? 'not set'}',
                            style: TextStyle(fontSize: 13, color: c.inkMuted)),
                      ),
                    ]),
                  ),
              ]),
            ),
            ?dragHandle,
          ]),
        ),
      ),
    );
  }
}
