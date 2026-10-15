import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';
import '../auth/auth_scaffold.dart';

/// Delete account (PRD §11.6) — required by both app stores.
class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});
  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    if (_password.text.isEmpty) {
      setState(() => _error = 'Enter your password to confirm');
      return;
    }
    final ok = await confirmDialog(context,
        title: 'Delete your account?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete account',
        destructive: true);
    if (!ok) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).deleteAccount(_password.text);
      await ref.read(authProvider.notifier).forgetLocally();
    } on ApiError catch (e) {
      final code = e.code ?? (e.body is Map ? (e.body as Map)['code'] as String? : null);
      setState(() => _error = switch (code) {
            'LAST_CLUB_ADMIN' => () {
                final clubs = e.body is Map && (e.body as Map)['clubs'] is List
                    ? ((e.body as Map)['clubs'] as List).map((c) => c is Map ? '${c['name'] ?? c['clubName'] ?? ''}' : '$c').join(', ')
                    : 'a club';
                return 'You are the last Club Admin of $clubs. Make another member Club Admin first.';
              }(),
            'LAST_SUPER_ADMIN' => 'You are the last Super Admin. Promote another account first.',
            _ => e.status == 401 || e.status == 403 ? 'That password is not correct.' : e.message,
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final s = ref.watch(signedInProvider);
    final isAdmin = s?.session.memberships.any((m) => m.roles.contains('ClubAdmin')) ?? false;

    Widget bullet(IconData icon, String text) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 18, color: c.inkSoft),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: t.bodyMedium)),
          ]),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Delete account')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
        Text('What gets removed', style: t.titleMedium),
        bullet(PhosphorIconsRegular.x, 'Your sign-in, password and profile (photo, bio, socials).'),
        bullet(PhosphorIconsRegular.x, 'Access to every club on Open Floor.'),
        const SizedBox(height: 12),
        Text('What the club keeps', style: t.titleMedium),
        bullet(PhosphorIconsRegular.check, 'Meeting history — speeches, roles and evaluations you took part in.'),
        bullet(PhosphorIconsRegular.check,
            'Your row on the club roster. Deleting your account does not take you off the roster — ask a club officer for that.'),
        if (isAdmin) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: c.warningSoft, borderRadius: BorderRadius.circular(10)),
            child: Text('You are a Club Admin. If you are the only one, make another member Club Admin before deleting.',
                style: TextStyle(color: c.warning, fontSize: 13.5)),
          ),
        ],
        const FieldLabel('Password'),
        PasswordField(controller: _password, hint: 'Enter your password to confirm'),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(_error!, style: TextStyle(color: c.danger)),
        ],
        const SizedBox(height: 24),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: c.danger, foregroundColor: Colors.white),
          onPressed: _busy ? null : _delete,
          child: _busy
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
              : const Text('Delete my account'),
        ),
      ]),
    );
  }
}
