import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../ui/widgets.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// The email gate: a signed-in account with `mustVerifyEmail` must confirm
/// an email before using the app. No skip — only sign out. The router sends
/// the user on once the session says the email is verified.
class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key});
  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};

  @override
  void initState() {
    super.initState();
    _email.text = ref.read(signedInProvider)?.session.user.email ?? '';
  }

  @override
  void dispose() {
    for (final c in [_email, _password, _code]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _fieldErrors = const {});
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on ApiError catch (e) {
      setState(() {
        switch (e.code) {
          case 'INVALID_CREDENTIALS':
            _fieldErrors = {'password': 'That password is not correct.'};
          case 'EMAIL_TAKEN':
            _codeSent = false;
            _error = authErrorText(e);
          case 'OTP_INVALID':
            _fieldErrors = {'code': authErrorText(e)};
          case 'EMAIL_ALREADY_VERIFIED':
            _error = authErrorText(e);
            // The session is stale; re-reading it lifts the gate.
            ref.read(authProvider.notifier).refreshSession().ignore();
          default:
            _error = authErrorText(e);
            _fieldErrors = e.fields;
        }
      });
      _form.currentState!.validate();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendCode() => _run(() async {
        await ref.read(apiProvider).sendEmailCode(_email.text.trim(), _password.text);
        setState(() => _codeSent = true);
      });

  Future<void> _resend() async {
    setState(() => _error = null);
    try {
      await ref.read(apiProvider).sendEmailCode(_email.text.trim(), _password.text);
    } on ApiError catch (e) {
      setState(() => _error = authErrorText(e));
      rethrow;
    }
  }

  // On success the session flips `mustVerifyEmail` off and the router
  // leaves this screen.
  Future<void> _verify() => _run(() async {
        await ref.read(authProvider.notifier).verifyEmail(_email.text.trim(), _code.text.trim());
      });

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AuthScaffold(
        title: 'Verify your email',
        subtitle: 'You will use it to sign in and to reset your password.',
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
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.email],
                    validator: (v) => validateEmail(v) ?? _fieldErrors['email'],
                    decoration: const InputDecoration(
                        hintText: 'name@example.com', prefixIcon: Icon(Icons.mail_outline, size: 20)),
                  ),
                  const FieldLabel('Current password'),
                  PasswordField(
                    controller: _password,
                    hint: 'Your password',
                    validator: (v) => (v ?? '').isEmpty ? 'Enter your password' : _fieldErrors['password'],
                    onSubmitted: (_) => _sendCode(),
                  ),
                  const SizedBox(height: 24),
                  SubmitButton(label: 'Send code', busy: _busy, onPressed: _sendCode),
                ] else ...[
                  AuthBanner('We sent a code to ${_email.text.trim()}.', success: true),
                  const FieldLabel('Code'),
                  CodeField(controller: _code, errorText: _fieldErrors['code'], onSubmitted: (_) => _verify()),
                  const SizedBox(height: 24),
                  SubmitButton(label: 'Verify', busy: _busy, onPressed: _verify),
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
                const SizedBox(height: 16),
                TextButton(
                  onPressed: _busy ? null : () => ref.read(authProvider.notifier).signOut(),
                  child: const Text('Sign out'),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}
