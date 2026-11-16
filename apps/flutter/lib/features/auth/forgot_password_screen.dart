import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../ui/widgets.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';
import 'sign_in_screen.dart';

/// Forgot password: email → code + new password → back to sign-in.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _error;
  String? _codeError;

  @override
  void dispose() {
    for (final c in [_email, _code, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _sendCode() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).forgotPassword(_email.text.trim());
      setState(() => _codeSent = true);
    } on ApiError catch (e) {
      setState(() => _error = authErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _error = null);
    try {
      await ref.read(apiProvider).forgotPassword(_email.text.trim());
    } on ApiError catch (e) {
      setState(() => _error = authErrorText(e));
      rethrow;
    }
  }

  Future<void> _reset() async {
    setState(() => _codeError = null);
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      await ref.read(apiProvider).resetPassword(email: email, code: _code.text.trim(), newPassword: _password.text);
      if (!mounted) return;
      context.go('/sign-in',
          extra: SignInArgs(notice: 'Password updated. Sign in with your new password.', email: email));
    } on ApiError catch (e) {
      if (e.code == 'OTP_INVALID') {
        setState(() => _codeError = authErrorText(e));
        _form.currentState!.validate();
      } else {
        setState(() => _error = authErrorText(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Reset password',
      subtitle: _codeSent ? 'Enter the code and a new password.' : 'We will email you a code.',
      children: [
        Form(
          key: _form,
          child: AutofillGroup(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_error != null) AuthBanner(_error!),
              if (!_codeSent) ...[
                const FieldLabel('Email'),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  autofillHints: const [AutofillHints.email],
                  validator: validateEmail,
                  onFieldSubmitted: (_) => _sendCode(),
                  decoration: const InputDecoration(
                      hintText: 'name@example.com', prefixIcon: Icon(Icons.mail_outline, size: 20)),
                ),
                const SizedBox(height: 24),
                SubmitButton(label: 'Send code', busy: _busy, onPressed: _sendCode),
              ] else ...[
                AuthBanner(
                  'If ${_email.text.trim()} has an account, we sent a code to it. It may take a minute.',
                  success: true,
                ),
                const FieldLabel('Code'),
                CodeField(controller: _code, errorText: _codeError),
                const FieldLabel('New password'),
                PasswordField(
                  controller: _password,
                  hint: 'At least 8 characters',
                  autofillHints: const [AutofillHints.newPassword],
                  validator: (v) => (v ?? '').length < 8 ? 'At least 8 characters' : null,
                  onSubmitted: (_) => _reset(),
                ),
                const SizedBox(height: 24),
                SubmitButton(label: 'Set new password', busy: _busy, onPressed: _reset),
                const SizedBox(height: 8),
                ResendCodeButton(onResend: _resend),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _codeSent = false;
                            _code.clear();
                            _error = null;
                          }),
                  child: const Text('Use a different email'),
                ),
              ],
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.push('/recover-whatsapp'),
                child: const Text('No access to your email? Get a code on WhatsApp'),
              ),
              TextButton(
                onPressed: () => context.canPop() ? context.pop() : context.go('/sign-in'),
                child: const Text('Back to sign in'),
              ),
            ]),
          ),
        ),
      ],
    );
  }
}
