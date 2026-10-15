import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';

final _invitePreviewProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, token) => ref.watch(apiProvider).invitePreview(token));

/// Club invite link (`/invite/:token`, PRD §5.4).
class InviteScreen extends ConsumerStatefulWidget {
  const InviteScreen({super.key, required this.token});
  final String token;
  @override
  ConsumerState<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends ConsumerState<InviteScreen> {
  bool _busy = false;

  Future<void> _accept() async {
    setState(() => _busy = true);
    try {
      final res = await ref.read(apiProvider).acceptInvite(widget.token);
      await ref.read(authProvider.notifier).refreshSession();
      final s = ref.read(signedInProvider);
      final joined = s?.session.contexts.where((c) => c.clubId == res['clubId']).firstOrNull;
      if (joined != null) await ref.read(authProvider.notifier).switchContext(joined);
      if (!mounted) return;
      showToast(context, 'Welcome to ${res['clubName'] ?? 'the club'}');
      context.go('/');
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final signedIn = ref.watch(signedInProvider) != null;
    final preview = ref.watch(_invitePreviewProvider(widget.token));

    return Scaffold(
      appBar: AppBar(title: const Text('Club invite')),
      body: AsyncBody<Map<String, dynamic>>(
        value: preview,
        onRetry: () => ref.invalidate(_invitePreviewProvider(widget.token)),
        builder: (p) {
          final state = p['state'] as String? ?? 'valid';
          if (state != 'valid') {
            return Center(
              child: EmptyState(
                icon: PhosphorIconsRegular.linkBreak,
                title: switch (state) {
                  'expired' => 'This invite has expired',
                  'accepted' => 'This invite has already been used',
                  _ => 'This invite is no longer valid',
                },
                message: 'Ask the club for a fresh invite link.',
              ),
            );
          }
          final roles = (p['roles'] as List? ?? const ['Member']).map((r) => roleLabel('$r')).join(', ');
          return ListView(padding: const EdgeInsets.all(20), children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [c.heroStart, c.heroEnd]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('YOU’RE INVITED TO', style: t.labelSmall?.copyWith(color: Colors.white70)),
                const SizedBox(height: 6),
                Text('${p['clubName'] ?? 'a club'}', style: t.headlineMedium?.copyWith(color: Colors.white)),
                const SizedBox(height: 12),
                Pill('Joining as $roles', color: c.mint, background: c.mintSoft),
              ]),
            ),
            const SizedBox(height: 16),
            Text('This link works once and can be revoked at any time by the club.', style: t.bodySmall),
            const SizedBox(height: 24),
            if (signedIn)
              FilledButton(
                onPressed: _busy ? null : _accept,
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : const Text('Accept & join'),
              )
            else ...[
              Text('Do you have an account?', style: t.titleMedium),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => context.push('/sign-in?from=/invite/${widget.token}'), child: const Text('Yes, log in')),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () => context.push('/register?from=/invite/${widget.token}'), child: const Text('No, sign up')),
            ],
          ]);
        },
      ),
    );
  }
}
