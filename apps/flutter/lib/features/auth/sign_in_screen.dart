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

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});
  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final s = ref.read(authProvider);
    if (s is SignedOut) _error = s.message;
  }

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).signIn(_phone.text.trim(), _password.text);
      TextInput.finishAutofillContext();
    } on ApiError catch (e) {
      setState(() => _error = switch (e.status) {
            401 => 'That phone number and password do not match.',
            403 => 'This account is suspended. Contact a club officer.',
            _ => e.message,
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
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: c.dangerSoft, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: TextStyle(color: c.danger, fontSize: 14)),
                ),
              ],
              const FieldLabel('Mobile number'),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.telephoneNumber],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                validator: validatePhone,
                decoration: const InputDecoration(hintText: '01XXXXXXXXX', prefixIcon: Icon(Icons.phone_outlined, size: 20)),
              ),
              const FieldLabel('Password'),
              PasswordField(
                controller: _password,
                validator: (v) => (v ?? '').isEmpty ? 'Enter your password' : null,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : const Text('Sign in'),
              ),
              const SizedBox(height: 16),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('New to Open Floor?', style: TextStyle(color: c.inkMuted)),
                TextButton(onPressed: () {
                    final from = GoRouterState.of(context).uri.queryParameters['from'];
                    context.push(from == null ? '/register' : '/register?from=$from');
                  }, child: const Text('Create an account')),
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
