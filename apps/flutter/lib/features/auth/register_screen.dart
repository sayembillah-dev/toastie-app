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

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _fieldErrors = const {});
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).register(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            password: _password.text,
            email: _email.text.trim(),
          );
    } on ApiError catch (e) {
      setState(() {
        _error = e.message;
        _fieldErrors = e.fields;
      });
      _form.currentState!.validate();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return AuthScaffold(
      title: 'Create your account',
      subtitle: 'You’ll be able to join a club right after signing in.',
      children: [
        Form(
          key: _form,
          child: AutofillGroup(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: c.dangerSoft, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: TextStyle(color: c.danger, fontSize: 14)),
                ),
              ],
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
              const FieldLabel('Email', optional: true),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                validator: (v) {
                  final s = (v ?? '').trim();
                  if (s.isNotEmpty && !s.contains('@')) return 'That does not look like an email';
                  return _fieldErrors['email'];
                },
                decoration: const InputDecoration(hintText: 'name@example.com'),
              ),
              const FieldLabel('Password'),
              PasswordField(
                controller: _password,
                hint: 'At least 8 characters',
                autofillHints: const [AutofillHints.newPassword],
                validator: (v) => (v ?? '').length < 8 ? 'Password must be at least 8 characters' : _fieldErrors['password'],
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : const Text('Create account'),
              ),
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
