import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../ui/widgets.dart';
import 'auth_scaffold.dart';
import 'auth_widgets.dart';

/// What another auth screen hands to sign-in (e.g. after a password reset).
class SignInArgs {
  const SignInArgs({this.notice, this.email});
  final String? notice;
  final String? email;
}

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key, this.args});
  final SignInArgs? args;
  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _id = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    final s = ref.read(authProvider);
    if (s is SignedOut) _error = s.message;
    _notice = widget.args?.notice;
    _id.text = widget.args?.email ?? '';
  }

  @override
  void dispose() {
    _id.dispose();
    _password.dispose();
    super.dispose();
  }

  /// One field takes either: anything with an "@" is an email, the rest a phone.
  static bool _isEmail(String v) => v.trim().contains('@');

  static String? _validateId(String? v) {
    final s = (v ?? '').trim();
    final ok = _isEmail(s) ? validateEmail(s) == null : validatePhone(normalizePhone(s)) == null;
    return ok ? null : 'Enter your email or phone number';
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      final id = _id.text.trim();
      final email = _isEmail(id);
      await ref.read(authProvider.notifier).signIn(
            email: email ? id.toLowerCase() : null,
            phone: email ? null : normalizePhone(id),
            password: _password.text,
          );
      TextInput.finishAutofillContext();
    } on ApiError catch (e) {
      if (e.code == 'PHONE_LOGIN_DISABLED') {
        final masked = e.body is Map ? (e.body as Map)['email'] as String? : null;
        _id.clear();
        setState(() {
          _error = masked == null
              ? 'This account signs in with email now. Use your email address.'
              : 'This account signs in with email now. Use $masked.';
        });
        return;
      }
      setState(() => _error = switch (e.code) {
            'INVALID_CREDENTIALS' => 'Email/phone or password is incorrect',
            _ => authErrorText(e),
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return AuthScaffold(
      title: 'Sign in',
      subtitle: 'Welcome back — enter your details to continue.',
      children: [
        Form(
          key: _form,
          child: AutofillGroup(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_notice != null) AuthBanner(_notice!, success: true),
              if (_error != null) AuthBanner(_error!),
              const FieldLabel('Email or phone'),
              TextFormField(
                controller: _id,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                enableSuggestions: false,
                autofillHints: const [AutofillHints.username, AutofillHints.email],
                validator: _validateId,
                decoration: const InputDecoration(
                    hintText: 'name@example.com or 01XXXXXXXXX', prefixIcon: Icon(Icons.person_outline, size: 20)),
              ),
              const FieldLabel('Password'),
              PasswordField(
                controller: _password,
                validator: (v) => (v ?? '').isEmpty ? 'Enter your password' : null,
                onSubmitted: (_) => _submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push('/forgot-password'),
                  child: const Text('Forgot password?'),
                ),
              ),
              const SizedBox(height: 8),
              SubmitButton(label: 'Sign in', busy: _busy, onPressed: _submit),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('New to Openfloor?', style: TextStyle(color: c.inkMuted)),
                TextButton(
                    onPressed: () {
                      final from = GoRouterState.of(context).uri.queryParameters['from'];
                      context.push(from == null ? '/register' : '/register?from=$from');
                    },
                    child: const Text('Create an account')),
              ]),
              const SizedBox(height: 8),
              Text(
                'Added to a club roster? Register with that phone number — your record links automatically.',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.inkMuted, fontSize: 13),
              ),
            ]),
          ),
        ),
      ],
    );
  }
}
