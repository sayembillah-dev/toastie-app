import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../core/bd_time.dart';
import '../../core/legal.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

enum _Step { email, code, details }

/// Email-first sign-up: email → 6-digit code (gives a signup token valid
/// for 30 min) → name, phone and password.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  _Step _step = _Step.email;
  String? _signupToken;
  bool _busy = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};

  @override
  void dispose() {
    for (final c in [_email, _code, _name, _phone, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Wraps one step's request: validation, busy flag, and error display.
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
      _onError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onError(ApiError e) {
    setState(() {
      switch (e.code) {
        case 'OTP_INVALID':
          _fieldErrors = {'code': authErrorText(e)};
        case 'PHONE_TAKEN':
          _fieldErrors = {'phone': authErrorText(e)};
        case 'EMAIL_TAKEN':
          _restart('That email already has an account. Sign in instead, or use another email.');
        case 'SIGNUP_TOKEN_INVALID':
          _restart('Your sign-up expired. Confirm your email again.');
        default:
          _error = authErrorText(e);
          _fieldErrors = e.fields;
      }
    });
    _form.currentState!.validate();
  }

  void _restart(String message) {
    _step = _Step.email;
    _signupToken = null;
    _code.clear();
    _error = message;
  }

  Future<void> _sendCode() => _run(() async {
        await ref.read(apiProvider).sendSignupCode(_email.text.trim());
        setState(() => _step = _Step.code);
      });

  Future<void> _resend() async {
    setState(() => _error = null);
    try {
      await ref.read(apiProvider).sendSignupCode(_email.text.trim());
    } on ApiError catch (e) {
      setState(() => _error = authErrorText(e));
      rethrow;
    }
  }

  Future<void> _verify() => _run(() async {
        final token = await ref.read(apiProvider).verifySignupCode(_email.text.trim(), _code.text.trim());
        setState(() {
          _signupToken = token;
          _step = _Step.details;
        });
      });

  Future<void> _register() => _run(() async {
        await ref.read(authProvider.notifier).register(
              signupToken: _signupToken!,
              name: _name.text.trim(),
              phone: _phone.text.trim(),
              password: _password.text,
            );
        TextInput.finishAutofillContext();
      });

  void _changeEmail() => setState(() {
        _step = _Step.email;
        _signupToken = null;
        _code.clear();
        _error = null;
        _fieldErrors = const {};
      });

  List<Widget> _emailStep() => [
        const FieldLabel('Email'),
        TextFormField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          autofillHints: const [AutofillHints.email],
          validator: (v) => validateEmail(v) ?? _fieldErrors['email'],
          onFieldSubmitted: (_) => _sendCode(),
          decoration: const InputDecoration(hintText: 'name@example.com', prefixIcon: Icon(Icons.mail_outline, size: 20)),
        ),
        const SizedBox(height: 24),
        SubmitButton(label: 'Send code', busy: _busy, onPressed: _sendCode),
      ];

  List<Widget> _codeStep() => [
        AuthBanner(
          'We sent a code to ${_email.text.trim()}. If you already have an account, check that email instead.',
          success: true,
        ),
        const FieldLabel('Code'),
        CodeField(
          controller: _code,
          errorText: _fieldErrors['code'],
          onSubmitted: (_) => _verify(),
          onCompleted: (_) {
            if (!_busy) _verify();
          },
        ),
        const SizedBox(height: 24),
        SubmitButton(label: 'Continue', busy: _busy, onPressed: _verify),
        const SizedBox(height: 8),
        ResendCodeButton(onResend: _resend),
        TextButton(onPressed: _busy ? null : _changeEmail, child: const Text('Use a different email')),
      ];

  List<Widget> _detailsStep() {
    final c = AppColors.of(context);
    return [
      const FieldLabel('Email'),
      Row(children: [
        Expanded(child: Text(_email.text.trim(), style: TextStyle(color: c.inkSoft, fontSize: 15))),
        TextButton(onPressed: _busy ? null : _changeEmail, child: const Text('Change')),
      ]),
      const FieldLabel('Full name'),
      TextFormField(
        controller: _name,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.name],
        validator: (v) => (v ?? '').trim().isEmpty ? 'Enter your name' : _fieldErrors['name'],
        decoration: const InputDecoration(hintText: 'e.g. Sayem Billah'),
      ),
      const FieldLabel('Mobile number'),
      TextFormField(
        controller: _phone,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.telephoneNumber],
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
        validator: (v) => validatePhone(v) ?? _fieldErrors['phone'],
        decoration: const InputDecoration(hintText: '01XXXXXXXXX'),
      ),
      const FieldLabel('Password'),
      PasswordField(
        controller: _password,
        hint: 'At least 8 characters',
        autofillHints: const [AutofillHints.newPassword],
        validator: (v) => (v ?? '').length < 8 ? 'Password must be at least 8 characters' : _fieldErrors['password'],
        onSubmitted: (_) => _register(),
      ),
      const SizedBox(height: 24),
      SubmitButton(label: 'Create account', busy: _busy, onPressed: _register),
      const SizedBox(height: 10),
      Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('By creating an account you agree to the', style: TextStyle(color: c.inkMuted, fontSize: 12.5)),
          _LegalLink('Terms of use', LegalPage.terms),
          Text('and', style: TextStyle(color: c.inkMuted, fontSize: 12.5)),
          _LegalLink('Privacy policy', LegalPage.privacy),
        ],
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return AuthScaffold(
      title: 'Create your account',
      subtitle: switch (_step) {
        _Step.email => 'Start with your email. We will send you a code.',
        _Step.code => 'Enter the code from your email.',
        _Step.details => 'Almost done. Tell us about you.',
      },
      children: [
        Form(
          key: _form,
          child: AutofillGroup(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_error != null) AuthBanner(_error!),
              ...switch (_step) {
                _Step.email => _emailStep(),
                _Step.code => _codeStep(),
                _Step.details => _detailsStep(),
              },
              const SizedBox(height: 12),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('Already have an account?', style: TextStyle(color: c.inkMuted)),
                TextButton(
                  onPressed: () => context.canPop() ? context.pop() : context.go('/sign-in'),
                  child: const Text('Sign in'),
                ),
              ]),
            ]),
          ),
        ),
      ],
    );
  }
}

class _LegalLink extends StatelessWidget {
  const _LegalLink(this.label, this.page);
  final String label;
  final LegalPage page;

  @override
  Widget build(BuildContext context) => TextButton(
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          minimumSize: const Size(0, 32),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          textStyle: const TextStyle(fontSize: 12.5, decoration: TextDecoration.underline),
        ),
        onPressed: () => openLegalPage(page),
        child: Text(label),
      );
}
