import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../ui/widgets.dart';

/// Theme & Word of the Day (PRD §7.9).
class ThemeScreen extends ConsumerStatefulWidget {
  const ThemeScreen({super.key, required this.meetingId});
  final String meetingId;
  @override
  ConsumerState<ThemeScreen> createState() => _ThemeScreenState();
}

class _ThemeScreenState extends ConsumerState<ThemeScreen> {
  final _form = GlobalKey<FormState>();
  final _theme = TextEditingController();
  final _word = TextEditingController();
  final _meaning = TextEditingController();
  final _example = TextEditingController();
  String _pos = '';
  bool _hydrated = false;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_theme, _word, _meaning, _example]) {
      c.dispose();
    }
    super.dispose();
  }

  void _hydrate(Meeting m) {
    if (_hydrated) return;
    _hydrated = true;
    _theme.text = m.theme;
    _word.text = m.word.word;
    _meaning.text = m.word.meaning;
    _example.text = m.word.example;
    _pos = partsOfSpeech.contains(m.word.partOfSpeech) ? m.word.partOfSpeech : '';
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) {
      showToast(context, 'Give the meeting a theme before saving.', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).updateMeeting(widget.meetingId, {
        'theme': _theme.text.trim(),
        'word': WordOfTheDay(
          word: _word.text.trim(),
          partOfSpeech: _pos,
          meaning: _meaning.text.trim(),
          example: _example.text.trim(),
        ).toJson(),
      });
      HapticFeedback.mediumImpact();
      ref.invalidate(meetingProvider(widget.meetingId));
      ref.invalidate(meetingsProvider);
      if (!mounted) return;
      showToast(context, 'Theme and word of the day saved');
      context.pop();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final meeting = ref.watch(meetingProvider(widget.meetingId));
    final canEdit = ref.watch(canProvider)(Act.update, 'meeting');

    return Scaffold(
      appBar: AppBar(title: const Text('Theme & Word of the Day')),
      bottomNavigationBar: canEdit
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: FilledButton(
                  onPressed: _busy ? null : _save,
                  child: _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                      : const Text('Save'),
                ),
              ),
            )
          : null,
      body: AsyncBody<Meeting>(
        value: meeting,
        builder: (m) {
          _hydrate(m);
          return Form(
            key: _form,
            child: AbsorbPointer(
              absorbing: !canEdit,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  const FieldLabel('Theme of the day'),
                  TextFormField(
                    controller: _theme,
                    maxLength: 120,
                    textCapitalization: TextCapitalization.words,
                    validator: (v) => (v ?? '').trim().isEmpty ? 'Give the meeting a theme' : null,
                    decoration: const InputDecoration(hintText: 'e.g. New Beginnings', counterText: ''),
                  ),
                  const SectionLabel('Word of the day', padding: EdgeInsets.fromLTRB(0, 24, 0, 0)),
                  const FieldLabel('Word'),
                  TextFormField(
                    controller: _word,
                    maxLength: 40,
                    decoration: const InputDecoration(hintText: 'e.g. Ephemeral', counterText: ''),
                  ),
                  const FieldLabel('Part of speech'),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final p in partsOfSpeech)
                      ChoiceChip(
                        label: Text(p),
                        selected: _pos == p,
                        onSelected: (sel) => setState(() => _pos = sel ? p : ''),
                      ),
                  ]),
                  const FieldLabel('Meaning'),
                  TextFormField(
                    controller: _meaning,
                    maxLength: 240,
                    maxLines: 3,
                    minLines: 2,
                    decoration: const InputDecoration(hintText: 'A concise definition of the word.'),
                  ),
                  const FieldLabel('Example sentence'),
                  TextFormField(
                    controller: _example,
                    maxLength: 240,
                    maxLines: 3,
                    minLines: 2,
                    decoration: const InputDecoration(hintText: 'Show the word in context.'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
