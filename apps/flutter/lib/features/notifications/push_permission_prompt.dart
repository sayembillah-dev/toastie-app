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
    final ready = s != null &&
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
    final turnOn = await showModalBottomSheet<bool>(
      context: context,
      useSafeArea: true,
      builder: (ctx) => const _PromptSheet(),
    );
    if (turnOn == true) {
      await push.requestPermission();
    } else {
      await push.markAsked();
    }
  }
}

class _PromptSheet extends StatelessWidget {
  const _PromptSheet();

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
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
          const SizedBox(height: 24),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Turn on')),
          const SizedBox(height: 8),
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Not now')),
        ]),
      ),
    );
  }
}
