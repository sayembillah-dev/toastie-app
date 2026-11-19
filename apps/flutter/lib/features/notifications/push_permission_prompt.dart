import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/push.dart';
import '../../app/session.dart';
import '../../core/theme/tokens.dart';
import '../../ui/icons.dart';

/// Asks once, inside the app, whether to turn notifications on, and only
/// shows the system permission dialog on "Turn on". Waits until the person
/// is actually in the app: not behind the email prompt, a forced password
/// change, or the join screen. Renders nothing itself.
class PushPermissionPrompt extends ConsumerStatefulWidget {
  const PushPermissionPrompt({super.key});

  @override
  ConsumerState<PushPermissionPrompt> createState() => _PushPermissionPromptState();
}

class _PushPermissionPromptState extends ConsumerState<PushPermissionPrompt> {
  bool _checked = false;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(signedInProvider);
    final ready =
        s != null &&
        s.context != null &&
        !s.session.user.mustVerifyEmail &&
        !(s.session.user.mustChangePassword && !s.skippedPasswordChange);
    if (ready && !_checked) {
      _checked = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeAsk());
    }
    return const SizedBox.shrink();
  }

  Future<void> _maybeAsk() async {
    final push = ref.read(pushProvider);
    if (push == null || !await push.shouldAsk() || !mounted) return;
    // Give the home screen a moment to settle before the sheet slides up.
    await Future<void>.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;
    final turnOn = await showPushPromptSheet(context);
    if (turnOn == true) {
      await push.requestPermission();
    } else {
      await push.markAsked();
    }
  }
}

/// Shows the prompt; resolves to true for "turn on", false or null otherwise.
Future<bool?> showPushPromptSheet(BuildContext context) {
  final screen = MediaQuery.sizeOf(context);
  return showModalBottomSheet<bool>(
    context: context,
    useSafeArea: true,
    // Without this the sheet is capped at ~56% of the screen height and the
    // second step overflows on ordinary phones. The content scrolls inside
    // these bounds, so small phones, landscape and big font sizes all fit;
    // the width cap keeps it from stretching edge to edge on tablets.
    isScrollControlled: true,
    constraints: BoxConstraints(maxWidth: 560, maxHeight: screen.height * 0.9),
    builder: (ctx) => const _PromptSheet(),
  );
}

/// Two steps in one sheet. "Not now" doesn't close it straight away: it
/// first lists what they'd miss and asks once more. A second "no" is final.
class _PromptSheet extends StatefulWidget {
  const _PromptSheet();

  @override
  State<_PromptSheet> createState() => _PromptSheetState();
}

class _PromptSheetState extends State<_PromptSheet> {
  bool _showMissed = false;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
        child: AnimatedSize(
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          alignment: Alignment.bottomCenter,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            transitionBuilder: (child, anim) => FadeTransition(
              opacity: anim,
              child: SlideTransition(
                position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(anim),
                child: child,
              ),
            ),
            child: _showMissed
                ? _MissedStep(
                    key: const ValueKey('missed'),
                    onTurnOn: () => Navigator.pop(context, true),
                    onSkip: () => Navigator.pop(context, false),
                  )
                : _AskStep(
                    key: const ValueKey('ask'),
                    onTurnOn: () => Navigator.pop(context, true),
                    onNotNow: () => setState(() => _showMissed = true),
                  ),
          ),
        ),
      ),
    );
  }
}

class _AskStep extends StatelessWidget {
  const _AskStep({super.key, required this.onTurnOn, required this.onNotNow});

  final VoidCallback onTurnOn;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    return _StepLayout(
      body: [
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(14)),
            child: Icon(PhosphorIconsRegular.bell, color: c.ink),
          ),
        ),
        const SizedBox(height: 16),
        Text('Turn on notifications?', style: t.titleLarge),
        const SizedBox(height: 8),
        Text(
          "Get told when you're given a meeting role, your speech is confirmed, a new meeting is "
          'scheduled, or a task is assigned to you.',
          style: t.bodyMedium?.copyWith(color: c.inkSoft),
        ),
      ],
      actions: [
        FilledButton(onPressed: onTurnOn, child: const Text('Turn on')),
        const SizedBox(height: 8),
        TextButton(onPressed: onNotNow, child: const Text('Not now')),
      ],
    );
  }
}

class _MissedStep extends StatelessWidget {
  const _MissedStep({super.key, required this.onTurnOn, required this.onSkip});

  final VoidCallback onTurnOn;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    return _StepLayout(
      body: [
        Text("You'll miss", style: t.titleLarge),
        const SizedBox(height: 12),
        const _MissedItem('Meeting updates'),
        const _MissedItem('Role assignments'),
        const _MissedItem('Speech confirmations'),
        const _MissedItem('Tasks & announcements'),
      ],
      actions: [
        FilledButton(onPressed: onTurnOn, child: const Text('Turn on')),
        const SizedBox(height: 8),
        TextButton(
          onPressed: onSkip,
          style: TextButton.styleFrom(foregroundColor: c.inkMuted),
          child: const Text('Skip'),
        ),
      ],
    );
  }
}

class _MissedItem extends StatelessWidget {
  const _MissedItem(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(color: c.dangerSoft, shape: BoxShape.circle),
            child: Icon(PhosphorIconsRegular.x, size: 14, color: c.danger),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label, style: t.bodyLarge?.copyWith(color: c.ink)),
          ),
        ],
      ),
    );
  }
}

/// A step's text scrolls when it doesn't fit; its buttons stay pinned below
/// so they're always reachable, whatever the screen or font size.
class _StepLayout extends StatelessWidget {
  const _StepLayout({required this.body, required this.actions});

  final List<Widget> body;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Flexible(
          child: SingleChildScrollView(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: body),
          ),
        ),
        const SizedBox(height: 20),
        ...actions,
      ],
    );
  }
}
