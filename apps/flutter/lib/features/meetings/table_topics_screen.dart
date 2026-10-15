import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';

const _maxQuestions = 10;
const _maxChars = 400;

/// Table Topic questions (PRD §7.10). Tap a question to read it out full
/// screen; swipe to mark it asked.
class TableTopicsScreen extends ConsumerWidget {
  const TableTopicsScreen({super.key, required this.meetingId});
  final String meetingId;

  ToastieApiCalls _api(WidgetRef ref) => ToastieApiCalls(ref, meetingId);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final topics = ref.watch(tableTopicsProvider(meetingId));
    final can = ref.watch(canProvider);
    final canWrite = can(Act.update, 'tableTopic');
    final canCreate = can(Act.create, 'tableTopic');
    final count = topics.value?.length ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Table Topics')),
      floatingActionButton: canCreate && count < _maxQuestions
          ? FloatingActionButton(
              tooltip: 'Add question',
              onPressed: () => _edit(context, ref, null),
              child: const Icon(PhosphorIconsBold.plus),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(tableTopicsProvider(meetingId).future),
        child: AsyncBody<List<TableTopic>>(
          value: topics,
          errorTitle: 'Could not load the questions',
          onRetry: () => ref.invalidate(tableTopicsProvider(meetingId)),
          builder: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 40),
                EmptyState(
                  icon: PhosphorIconsRegular.lightbulb,
                  title: 'No questions yet',
                  message: 'Add up to 10 questions for the Table Topics Master.',
                ),
              ]);
            }
            return ListView(padding: const EdgeInsets.only(bottom: 100), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Text(
                  '${list.where((t) => t.asked).length} of ${list.length} asked · tap to read out, swipe to mark asked',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              for (var i = 0; i < list.length; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Dismissible(
                    key: ValueKey('${list[i].id}-${list[i].asked}'),
                    direction: canWrite ? DismissDirection.startToEnd : DismissDirection.none,
                    confirmDismiss: (_) async {
                      HapticFeedback.lightImpact();
                      await _api(ref).toggle(list[i]);
                      return false;
                    },
                    background: Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 20),
                      decoration: BoxDecoration(color: c.successSoft, borderRadius: BorderRadius.circular(12)),
                      child: Text(list[i].asked ? 'Mark not asked' : 'Mark asked',
                          style: TextStyle(color: c.success, fontWeight: FontWeight.w600)),
                    ),
                    child: AppCard(
                      margin: EdgeInsets.zero,
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        fullscreenDialog: true,
                        builder: (_) => _ReadOut(question: list[i], index: i + 1),
                      )),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${i + 1}', style: TextStyle(fontWeight: FontWeight.w700, color: c.inkMuted)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            list[i].text,
                            style: TextStyle(
                              fontSize: 15,
                              height: 1.4,
                              color: list[i].asked ? c.inkMuted : c.ink,
                              decoration: list[i].asked ? TextDecoration.lineThrough : null,
                            ),
                          ),
                        ),
                        if (canWrite)
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            tooltip: 'More options',
                            icon: Icon(PhosphorIconsBold.dotsThreeVertical, size: 18, color: c.inkMuted),
                            onPressed: () => showActionSheet(context, actions: [
                              SheetAction(
                                icon: list[i].asked ? PhosphorIconsRegular.arrowCounterClockwise : PhosphorIconsRegular.check,
                                label: list[i].asked ? 'Mark not asked' : 'Mark asked',
                                onTap: () => _api(ref).toggle(list[i]),
                              ),
                              SheetAction(
                                icon: PhosphorIconsRegular.pencilSimple,
                                label: 'Edit',
                                onTap: () => _edit(context, ref, list[i]),
                              ),
                              if (can(Act.delete, 'tableTopic'))
                                SheetAction(
                                  icon: PhosphorIconsRegular.trash,
                                  label: 'Delete',
                                  destructive: true,
                                  onTap: () => _api(ref).delete(context, list[i]),
                                ),
                            ]),
                          ),
                      ]),
                    ),
                  ),
                ),
            ]);
          },
        ),
      ),
    );
  }

  Future<void> _edit(BuildContext context, WidgetRef ref, TableTopic? existing) async {
    final ctl = TextEditingController(text: existing?.text ?? '');
    final text = await showFormSheet<String>(
      context,
      builder: (ctx) => SheetScaffold(
        title: existing == null ? 'Add question' : 'Edit question',
        primaryLabel: 'Save',
        onPrimary: () {
          if (ctl.text.trim().isEmpty) return;
          Navigator.pop(ctx, ctl.text.trim());
        },
        children: [
          TextField(
            controller: ctl,
            autofocus: true,
            maxLength: _maxChars,
            maxLines: 6,
            minLines: 3,
            decoration: const InputDecoration(hintText: 'Write the question. Use new lines for follow-ups.'),
          ),
        ],
      ),
    );
    if (text == null || text.isEmpty) return;
    if (!context.mounted) return;
    await _api(ref).save(context, existing, text);
  }
}

/// Thin mutation helpers so the list stays declarative.
class ToastieApiCalls {
  ToastieApiCalls(this.ref, this.meetingId);
  final WidgetRef ref;
  final String meetingId;

  Future<void> toggle(TableTopic t) async {
    try {
      await ref.read(apiProvider).http.patch('meetings/$meetingId/table-topics/${t.id}', body: {'asked': !t.asked});
    } finally {
      ref.invalidate(tableTopicsProvider(meetingId));
    }
  }

  Future<void> save(BuildContext context, TableTopic? existing, String text) async {
    try {
      if (existing == null) {
        await ref.read(apiProvider).http.post('meetings/$meetingId/table-topics', body: {'text': text});
      } else {
        await ref.read(apiProvider).http.patch('meetings/$meetingId/table-topics/${existing.id}', body: {'text': text});
      }
      ref.invalidate(tableTopicsProvider(meetingId));
    } catch (e) {
      if (context.mounted) showToast(context, errorText(e), error: true);
    }
  }

  Future<void> delete(BuildContext context, TableTopic t) async {
    final ok = await confirmDialog(context, title: 'Delete this question?', confirmLabel: 'Delete', destructive: true);
    if (!ok) return;
    try {
      await ref.read(apiProvider).http.delete('meetings/$meetingId/table-topics/${t.id}');
      ref.invalidate(tableTopicsProvider(meetingId));
    } catch (e) {
      if (context.mounted) showToast(context, errorText(e), error: true);
    }
  }
}

class _ReadOut extends StatefulWidget {
  const _ReadOut({required this.question, required this.index});
  final TableTopic question;
  final int index;
  @override
  State<_ReadOut> createState() => _ReadOutState();
}

class _ReadOutState extends State<_ReadOut> {
  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
  }

  @override
  void dispose() {
    WakelockPlus.disable();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(backgroundColor: c.canvas, title: Text('Question ${widget.index}')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Text(
              widget.question.text,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 30, height: 1.35, fontWeight: FontWeight.w600, color: c.ink),
            ),
          ),
        ),
      ),
    );
  }
}
