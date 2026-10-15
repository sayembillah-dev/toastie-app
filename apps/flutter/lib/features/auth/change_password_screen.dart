import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';
import 'auth_scaffold.dart';

/// Change password. When [forced] (the account has a temporary password) it
/// shows the warning banner and a "Skip for now" escape.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key, this.forced = false});
  final bool forced;

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _currentError;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _currentError = null);
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).changePassword(_current.text, _next.text);
      await ref.read(authProvider.notifier).refreshSession();
      if (!mounted) return;
      showToast(context, 'Password updated');
      if (widget.forced) {
        context.go('/');
      } else {
        context.pop();
      }
    } on ApiError catch (e) {
      if (e.status == 400 || e.status == 401 || e.status == 403) {
        setState(() => _currentError = e.message);
        _form.currentState!.validate();
      } else if (mounted) {
        showToast(context, e.message, error: true);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Change password'),
        automaticallyImplyLeading: !widget.forced,
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            if (widget.forced)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: c.warningSoft, borderRadius: BorderRadius.circular(12)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(PhosphorIconsFill.warning, color: c.warning, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('You’re using a temporary password',
                          style: TextStyle(fontWeight: FontWeight.w600, color: c.ink)),
                      const SizedBox(height: 2),
                      Text('Set your own to keep your account secure — or skip for now and do it later.',
                          style: TextStyle(fontSize: 13.5, color: c.inkSoft)),
                    ]),
                  ),
                ]),
              ),
            const SizedBox(height: 4),
            Text('Enter your current password to confirm it’s you.', style: Theme.of(context).textTheme.bodySmall),
            const FieldLabel('Current password'),
            PasswordField(
              controller: _current,
              hint: 'Current password',
              textInputAction: TextInputAction.next,
              validator: (v) => (v ?? '').isEmpty ? 'Current password is required' : _currentError,
            ),
            const FieldLabel('New password'),
            PasswordField(
              controller: _next,
              hint: 'At least 8 characters',
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
              validator: (v) => (v ?? '').length < 8 ? 'At least 8 characters' : null,
            ),
            const FieldLabel('Confirm new password'),
            PasswordField(
              controller: _confirm,
              hint: 'Confirm your new password',
              autofillHints: const [AutofillHints.newPassword],
              validator: (v) => v != _next.text ? 'The passwords do not match' : null,
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                  : const Text('Update password'),
            ),
            if (widget.forced) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  ref.read(authProvider.notifier).skipPasswordChange();
                  context.go('/');
                },
                child: const Text('Skip for now'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
