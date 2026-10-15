import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../ui/widgets.dart';
import 'speech_cards.dart';

class MySpeechesScreen extends ConsumerWidget {
  const MySpeechesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(myMembershipIdProvider);
    if (me == null) {
      return Scaffold(appBar: AppBar(title: const Text('My speeches')), body: const SizedBox.shrink());
    }
    final speeches = ref.watch(mySpeechesProvider(me));
    return Scaffold(
      appBar: AppBar(title: const Text('My speeches')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(memberHistoryProvider(me));
          ref.invalidate(receivedEvaluationsProvider(me));
          ref.invalidate(timerEntriesProvider(me));
          ref.invalidate(ahEntriesProvider(me));
          await ref.read(mySpeechesProvider(me).future);
        },
        child: AsyncBody<List<SpeechWithReports>>(
          value: speeches,
          onRetry: () => ref.invalidate(mySpeechesProvider(me)),
          builder: (list) => list.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 40),
                  EmptyState(icon: PhosphorIconsRegular.microphone, title: 'No speeches yet'),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.only(top: 4, bottom: 32),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => SpeechCard(speech: list[i]),
                ),
        ),
      ),
    );
  }
}
