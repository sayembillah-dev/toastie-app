import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../core/bd_time.dart';
import '../../ui/widgets.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// Password recovery for older accounts with no verified email: the code
/// arrives on WhatsApp, and a successful reset signs the user in.
class WhatsappRecoveryScreen extends ConsumerStatefulWidget {
  const WhatsappRecoveryScreen({super.key});
  @override
  ConsumerState<WhatsappRecoveryScreen> createState() => _WhatsappRecoveryScreenState();
}

class _WhatsappRecoveryScreenState extends ConsumerState<WhatsappRecoveryScreen> {
  final _form = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _error;
  String? _codeError;

  @override
  void dispose() {
    for (final c in [_phone, _code, _password]) {
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
      await ref.read(apiProvider).requestWhatsappCode(_phone.text.trim());
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
      await ref.read(apiProvider).requestWhatsappCode(_phone.text.trim());
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
      // Signs in; the router then moves on (to the email gate if needed).
      await ref.read(authProvider.notifier).resetWithWhatsapp(
            phone: _phone.text.trim(),
            code: _code.text.trim(),
            newPassword: _password.text,
          );
      TextInput.finishAutofillContext();
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
      title: 'Reset with WhatsApp',
      subtitle: _codeSent ? 'Enter the code and a new password.' : 'We will send a code to your WhatsApp.',
      children: [
        Form(
          key: _form,
          child: AutofillGroup(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_error != null) AuthBanner(_error!),
              if (!_codeSent) ...[
                const FieldLabel('Mobile number'),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                  validator: validatePhone,
                  onFieldSubmitted: (_) => _sendCode(),
                  decoration:
                      const InputDecoration(hintText: '01XXXXXXXXX', prefixIcon: Icon(Icons.phone_outlined, size: 20)),
                ),
                const SizedBox(height: 8),
                Text(
                  'For accounts without a verified email. If yours has one, reset by email instead.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 24),
                SubmitButton(label: 'Send code', busy: _busy, onPressed: _sendCode),
              ] else ...[
                AuthBanner(
                  'If ${_phone.text.trim()} can use WhatsApp recovery, we sent a code to it on WhatsApp.',
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
                SubmitButton(label: 'Set password and sign in', busy: _busy, onPressed: _reset),
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
                  child: const Text('Use a different number'),
                ),
              ],
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.go('/sign-in'),
                child: const Text('Back to sign in'),
              ),
            ]),
          ),
        ),
      ],
    );
  }
}
