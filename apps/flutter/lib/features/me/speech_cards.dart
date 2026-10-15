import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/data.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';

/// A delivered speech with the three reports collected for it. Reports join
/// to the history event by `speechEventId`; evaluation feedback joins by
/// `meetingSpeakerId` (it's submitted against the speaker slot).
class SpeechWithReports {
  SpeechWithReports(this.event, this.feedback, this.timer, this.ah);
  final HistoryEvent event;
  final List<ReceivedEvaluation> feedback;
  final TimerReport? timer;
  final AhReport? ah;
}

final mySpeechesProvider = FutureProvider.family<List<SpeechWithReports>, String>((ref, membershipId) async {
  final history = await ref.watch(memberHistoryProvider(membershipId).future);
  Future<List<T>> soft<T>(Future<List<T>> f) => f.catchError((_) => <T>[]);
  final feedback = await soft(ref.watch(receivedEvaluationsProvider(membershipId).future));
  final timers = await soft(ref.watch(timerEntriesProvider(membershipId).future));
  final ahs = await soft(ref.watch(ahEntriesProvider(membershipId).future));
  final timerBy = {for (final t in timers) t.speechEventId: t};
  final ahBy = {for (final a in ahs) a.speechEventId: a};
  return [
    for (final e in history.where((e) => e.type == 'speech-given'))
      SpeechWithReports(
        e,
        feedback.where((f) => e.meetingSpeakerId != null && f.meetingSpeakerId == e.meetingSpeakerId).toList(),
        timerBy[e.id],
        ahBy[e.id],
      ),
  ];
});

class SpeechCard extends StatelessWidget {
  const SpeechCard({super.key, required this.speech});
  final SpeechWithReports speech;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final e = speech.event;
    final title = (e.title ?? '').trim().isEmpty ? 'Untitled speech' : '“${e.title}”';
    final meta = [
      if (e.meetingNumber != null) 'Meeting #${e.meetingNumber}',
      BdTime.calendarDate(e.date),
      if (e.projectName != null) e.projectName!,
    ].join(' · ');

    final timer = speech.timer;
    final ah = speech.ah;
    final timerColor = switch (timer?.verdict) {
      'Within time' => c.success,
      'Over time' => c.danger,
      'Under time' => c.warning,
      _ => c.inkMuted,
    };

    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: t.titleMedium),
        const SizedBox(height: 2),
        Text(meta, style: t.bodySmall),
        const SizedBox(height: 12),
        _ReportRow(
          icon: PhosphorIconsRegular.chatCenteredText,
          label: 'Evaluation',
          value: speech.feedback.isEmpty
              ? 'Awaiting evaluation'
              : '${speech.feedback.length} received',
          valueColor: speech.feedback.isEmpty ? c.inkMuted : c.success,
          onTap: speech.feedback.isEmpty ? null : () => _showFeedback(context, speech),
        ),
        _ReportRow(
          icon: PhosphorIconsRegular.timer,
          label: 'Timing',
          value: timer == null
              ? 'Not yet timed'
              : '${timer.verdict} · ${_mmss(timer.actualSeconds)} (${timer.targetMinMinutes}–${timer.targetMaxMinutes} min)',
          valueColor: timerColor,
        ),
        _ReportRow(
          icon: PhosphorIconsRegular.speakerHigh,
          label: 'Ah-Counter',
          value: ah == null
              ? 'Not yet counted'
              : '${ah.total} filler${ah.total == 1 ? '' : 's'}${ah.fillerCounts.isEmpty ? '' : ' · ${ah.fillerCounts.entries.where((e) => e.value > 0).map((e) => '${e.key.toUpperCase()} ${e.value}').join(', ')}'}',
          valueColor: ah == null ? c.inkMuted : c.ink,
        ),
      ]),
    );
  }

  static String _mmss(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';

  void _showFeedback(BuildContext context, SpeechWithReports speech) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) {
        final t = Theme.of(ctx).textTheme;
        final c = AppColors.of(ctx);
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          maxChildSize: 0.95,
          builder: (ctx, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
            Text('Evaluation feedback', style: t.titleLarge),
            const SizedBox(height: 12),
            for (final f in speech.feedback) ...[
              Row(children: [
                Avatar(name: f.evaluatorName, size: 32),
                const SizedBox(width: 10),
                Expanded(child: Text(f.evaluatorName, style: t.titleMedium)),
                Pill(f.isAssignedEvaluator ? 'Assigned' : 'Peer feedback'),
              ]),
              const SizedBox(height: 8),
              if (f.text != null) Text(f.text!, style: t.bodyMedium),
              if (f.audioUrl != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: OutlinedButton.icon(
                    onPressed: () => launchUrl(Uri.parse(f.audioUrl!), mode: LaunchMode.externalApplication),
                    icon: const Icon(PhosphorIconsRegular.play, size: 18),
                    label: const Text('Play voice note'),
                  ),
                ),
              if (f.imageUrls.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final u in f.imageUrls)
                      GestureDetector(
                        onTap: () => launchUrl(Uri.parse(u), mode: LaunchMode.externalApplication),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(u, width: 96, height: 96, fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(width: 96, height: 96, color: c.fill)),
                        ),
                      ),
                  ]),
                ),
              Divider(height: 28, color: c.line),
            ],
          ]),
        );
      },
    );
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.icon, required this.label, required this.value, required this.valueColor, this.onTap});
  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 18, color: c.inkSoft),
          const SizedBox(width: 10),
          SizedBox(width: 92, child: Text(label, style: TextStyle(fontSize: 14, color: c.inkSoft))),
          Expanded(
            child: Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: valueColor)),
          ),
          if (onTap != null) const Chevron(),
        ]),
      ),
    );
  }
}
