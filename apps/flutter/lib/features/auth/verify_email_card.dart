import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/session.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart' show Json;
import '../../ui/widgets.dart';
import 'auth_widgets.dart';

enum _Step { email, code, done }

/// The verify-email prompt drawn by `EmailGate` over the app. Three faces:
/// no email yet ("Add your email"), an unverified one ("Verify your email"),
/// and the code step. It never navigates — there is no navigator above it —
/// and the only exits are a verified email or signing out.
class VerifyEmailCard extends ConsumerStatefulWidget {
  const VerifyEmailCard({super.key});
  @override
  ConsumerState<VerifyEmailCard> createState() => _VerifyEmailCardState();
}

class _VerifyEmailCardState extends ConsumerState<VerifyEmailCard> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _emailFocus = FocusNode();

  /// The address on the account when the prompt opened (null: none yet).
  late final String? _onFile = ref.read(signedInProvider)?.session.user.email;
  late final String _name = ref.read(signedInProvider)?.session.user.firstName ?? '';

  late bool _editing = _onFile == null;
  _Step _step = _Step.email;
  String _sentTo = '';
  bool _busy = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};

  @override
  void initState() {
    super.initState();
    // A server error under a field clears as soon as that field is edited.
    _code.addListener(() => _clearFieldError('code'));
    _email.addListener(() => _clearFieldError('email'));
  }

  void _clearFieldError(String field) {
    if (!_fieldErrors.containsKey(field)) return;
    setState(() => _fieldErrors = Map.of(_fieldErrors)..remove(field));
  }

  @override
  void dispose() {
    for (final c in [_email, _code]) {
      c.dispose();
    }
    _emailFocus.dispose();
    super.dispose();
  }

  String get _target => _editing ? _email.text.trim().toLowerCase() : _onFile!;

  Future<void> _run(Future<void> Function() action, void Function(ApiError e) onError) async {
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
      if (!mounted) return;
      setState(() => onError(e));
      // Re-run validators once rebuilt, so server field errors show under
      // their fields (CodeField takes its error as a widget argument).
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _form.currentState?.validate();
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _commonError(ApiError e) {
    switch (e.code) {
      case 'EMAIL_ALREADY_VERIFIED':
        _error = authErrorText(e);
        // The session is stale; re-reading it closes the prompt.
        ref.read(authProvider.notifier).refreshSession().ignore();
      default:
        _error = authErrorText(e);
        _fieldErrors = e.fields;
    }
  }

  Future<void> _sendCode() => _run(
    () async {
      final to = _target;
      await ref.read(apiProvider).sendEmailCode(to);
      if (!mounted) return;
      setState(() {
        _sentTo = to;
        _code.clear();
        _step = _Step.code;
      });
    },
    (e) {
      switch (e.code) {
        case 'EMAIL_TAKEN' when _editing:
          _fieldErrors = {'email': authErrorText(e)};
        case 'EMAIL_TAKEN':
          _startEditing(clear: true);
          _error = '$_onFile is already used by another account. Use a different email.';
        default:
          _commonError(e);
      }
    },
  );

  Future<void> _resend() async {
    setState(() => _error = null);
    try {
      await ref.read(apiProvider).sendEmailCode(_sentTo);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = authErrorText(e));
      rethrow;
    }
  }

  Future<void> _verify() => _run(
    () async {
      final raw = await ref.read(apiProvider).verifyEmail(_sentTo, _code.text.trim());
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() => _step = _Step.done);
      // Let the success land, then adopt the session — that closes the prompt.
      await Future<void>.delayed(const Duration(milliseconds: 1400));
      // Gone meanwhile (signed out, session expired): nothing to hand over.
      if (!mounted) return;
      await _adopt(raw);
    },
    (e) {
      switch (e.code) {
        case 'OTP_INVALID':
          _fieldErrors = {'code': authErrorText(e)};
        case 'EMAIL_TAKEN':
          _step = _Step.email;
          _startEditing(clear: true);
          _error = authErrorText(e);
        default:
          _commonError(e);
      }
    },
  );

  Future<void> _adopt(Json raw) async {
    try {
      await ref.read(authProvider.notifier).adoptSession(raw);
    } catch (_) {
      // Fall back to a fresh read; the server already has the email verified.
      await ref.read(authProvider.notifier).refreshSession().catchError((_) {});
    }
  }

  void _startEditing({bool clear = false}) {
    _editing = true;
    if (clear) _email.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _emailFocus.requestFocus();
    });
  }

  void _useDifferentEmail() => setState(() {
    _step = _Step.email;
    _error = null;
    _fieldErrors = const {};
    _code.clear();
    _startEditing(clear: true);
  });

  void _keepOnFile() => setState(() {
    _editing = false;
    _error = null;
    _fieldErrors = const {};
  });

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final dark = Theme.of(context).brightness == Brightness.dark;

    final (IconData icon, String title, String why) = switch (_step) {
      _Step.email when _onFile == null => (
        Icons.alternate_email_rounded,
        'Add your email',
        'Openfloor now signs you in and resets your password by email.',
      ),
      _Step.email => (
        Icons.mark_email_unread_outlined,
        'Verify your email',
        'Confirm this address so you can sign in and reset your password with it.',
      ),
      _Step.code => (
        Icons.forward_to_inbox_outlined,
        'Check your inbox',
        'Enter the 6-digit code we just emailed you.',
      ),
      _Step.done => (Icons.check_rounded, 'Email verified', 'You are all set. Taking you to the app…'),
    };

    // Back is swallowed by EmailGate (there is no route here for a PopScope).
    return Container(
      decoration: BoxDecoration(
        color: dark ? c.surface : c.canvas,
        borderRadius: BorderRadius.circular(24),
        border: dark ? Border.all(color: c.line) : null,
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 40, offset: const Offset(0, 18)),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 12),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
        alignment: Alignment.topCenter,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: _Badge(icon: icon, success: _step == _Step.done),
            ),
            const SizedBox(height: 20),
            _Fade(
              id: title,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: t.headlineMedium?.copyWith(fontSize: 24)),
                  const SizedBox(height: 6),
                  Text(why, style: t.bodyMedium?.copyWith(color: c.inkSoft)),
                ],
              ),
            ),
            Form(
              key: _form,
              child: AutofillGroup(
                child: _Fade(
                  id: '$_step/$_editing',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) AuthBanner(_error!),
                      ...switch (_step) {
                        _Step.email => _emailStep(c),
                        _Step.code => _codeStep(c),
                        _Step.done => [const SizedBox(height: 8)],
                      },
                    ],
                  ),
                ),
              ),
            ),
            if (_step != _Step.done) ...[
              const SizedBox(height: 12),
              Divider(height: 1, color: c.line),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _name.isEmpty ? 'Not you?' : 'Not $_name?',
                      style: t.bodySmall?.copyWith(color: c.inkMuted),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _busy ? null : () => ref.read(authProvider.notifier).signOut(),
                    icon: const Icon(Icons.logout_rounded, size: 18),
                    label: const Text('Sign out'),
                  ),
                ],
              ),
            ] else
              const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  List<Widget> _emailStep(AppColors c) => [
    if (_editing) ...[
      const FieldLabel('Email'),
      TextFormField(
        controller: _email,
        focusNode: _emailFocus,
        keyboardType: TextInputType.emailAddress,
        autocorrect: false,
        textInputAction: TextInputAction.send,
        autofillHints: const [AutofillHints.email],
        onFieldSubmitted: (_) => _sendCode(),
        validator: (v) => validateEmail(v) ?? _fieldErrors['email'],
        decoration: const InputDecoration(hintText: 'name@example.com', prefixIcon: Icon(Icons.mail_outline, size: 20)),
      ),
    ] else ...[
      const SizedBox(height: 18),
      _AddressTile(email: _onFile!),
    ],
    const SizedBox(height: 20),
    SubmitButton(label: 'Send code', busy: _busy, onPressed: _sendCode),
    const SizedBox(height: 4),
    if (_onFile != null)
      TextButton(
        onPressed: _busy ? null : (_editing ? _keepOnFile : _useDifferentEmail),
        child: Text(_editing ? 'Use $_onFile instead' : 'Use a different email', overflow: TextOverflow.ellipsis),
      ),
  ];

  List<Widget> _codeStep(AppColors c) => [
    const SizedBox(height: 18),
    _AddressTile(email: _sentTo, caption: 'Code sent to'),
    const FieldLabel('Code'),
    CodeField(
      controller: _code,
      errorText: _fieldErrors['code'],
      onSubmitted: (_) => _verify(),
      onCompleted: (_) {
        if (!_busy) _verify();
      },
    ),
    const SizedBox(height: 20),
    SubmitButton(label: 'Verify', busy: _busy, onPressed: _verify),
    const SizedBox(height: 4),
    Wrap(
      alignment: WrapAlignment.center,
      children: [
        ResendCodeButton(onResend: _resend),
        TextButton(onPressed: _busy ? null : _useDifferentEmail, child: const Text('Use a different email')),
      ],
    ),
  ];
}

/// Navy tile with a mint glyph; turns mint with a check once verified.
class _Badge extends StatelessWidget {
  const _Badge({required this.icon, required this.success});
  final IconData icon;
  final bool success;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: success ? [c.mint, c.mint] : [c.heroStart, c.heroEnd],
        ),
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 280),
        transitionBuilder: (child, a) => ScaleTransition(
          scale: a,
          child: FadeTransition(opacity: a, child: child),
        ),
        child: Icon(icon, key: ValueKey(icon), size: 28, color: success ? c.heroEnd : c.mint),
      ),
    );
  }
}

/// The address being verified, shown as a quiet tile rather than a field.
class _AddressTile extends StatelessWidget {
  const _AddressTile({required this.email, this.caption});
  final String email;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(Radii.control)),
      child: Row(
        children: [
          Icon(Icons.mail_outline, size: 20, color: c.inkSoft),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (caption != null) Text(caption!, style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
                Text(
                  email,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.ink),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Cross-fade with a small upward slide whenever [id] changes.
class _Fade extends StatelessWidget {
  const _Fade({required this.id, required this.child});
  final String id;
  final Widget child;

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: const Duration(milliseconds: 240),
    switchInCurve: Curves.easeOutCubic,
    switchOutCurve: Curves.easeInCubic,
    layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
    transitionBuilder: (child, a) => FadeTransition(
      opacity: a,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(a),
        child: child,
      ),
    ),
    child: KeyedSubtree(key: ValueKey(id), child: child),
  );
}
