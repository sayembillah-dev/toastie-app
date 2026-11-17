import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';

/// Plain words for the auth API's error codes. Many of these come back with
/// only a `code`, so the fallback message would be generic.
String authErrorText(ApiError e) => switch (e.code) {
      'INVALID_CREDENTIALS' => 'That email or phone and password do not match.',
      'USER_SUSPENDED' => 'This account is suspended. Contact a club officer.',
      'OTP_INVALID' => 'That code is wrong or has expired.',
      'OTP_COOLDOWN' => 'Wait a minute, then ask for a new code.',
      'OTP_LIMIT' => 'Too many codes. Try again later.',
      'EMAIL_TAKEN' => 'That email is already used by another account.',
      'EMAIL_ALREADY_VERIFIED' => 'This account already has a verified email.',
      'PHONE_TAKEN' => 'That mobile number is already used by another account.',
      'MAIL_SEND_FAILED' => 'We could not send the email. Try again shortly.',
      'SIGNUP_TOKEN_INVALID' => 'Your sign-up expired. Start again.',
      _ => e.status == 429 ? 'Too many tries. Wait a minute and try again.' : e.message,
    };

String? validateEmail(String? v, {String empty = 'Enter your email'}) {
  final s = (v ?? '').trim();
  if (s.isEmpty) return empty;
  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(s)) return 'That does not look like an email';
  return null;
}

String? validateCode(String? v) =>
    RegExp(r'^\d{6}$').hasMatch((v ?? '').trim()) ? null : 'Enter the 6-digit code';

/// Error (red) or notice (green) box at the top of an auth form.
class AuthBanner extends StatelessWidget {
  const AuthBanner(this.text, {super.key, this.success = false});
  final String text;
  final bool success;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: success ? c.successSoft : c.dangerSoft,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(text, style: TextStyle(color: success ? c.success : c.danger, fontSize: 14)),
      ),
    );
  }
}

/// The 6-digit code field shared by every one-time-code step.
///
/// Keeps only digits, so a pasted "123 456" or "Your code is 123456" lands
/// as `123456`. A paste over a part-typed code replaces it instead of
/// mixing the two. [onCompleted] fires once all six digits are in, typed
/// or pasted — pass it only where the code is the form's sole field.
class CodeField extends StatelessWidget {
  const CodeField({super.key, required this.controller, this.errorText, this.onSubmitted, this.onCompleted});
  final TextEditingController controller;
  final String? errorText;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onCompleted;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        keyboardType: TextInputType.number,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.oneTimeCode],
        inputFormatters: [CodeInputFormatter()],
        validator: (v) => validateCode(v) ?? errorText,
        onChanged: (v) {
          if (v.length == codeLength) onCompleted?.call(v);
        },
        onFieldSubmitted: onSubmitted,
        style: const TextStyle(letterSpacing: 6, fontSize: 18, fontWeight: FontWeight.w600),
        decoration: const InputDecoration(hintText: '6-digit code', prefixIcon: Icon(Icons.pin_outlined, size: 20)),
      );
}

const codeLength = 6;

/// Digits only, at most [codeLength]. When an edit would go past the limit
/// and the inserted text holds a whole code, that code wins — the user
/// pasted a fresh code on top of an old or part-typed one.
class CodeInputFormatter extends TextInputFormatter {
  static final _nonDigit = RegExp(r'\D');

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var digits = newValue.text.replaceAll(_nonDigit, '');
    if (digits.length > codeLength) {
      final pasted = _inserted(oldValue.text, newValue.text).replaceAll(_nonDigit, '');
      digits = (pasted.length >= codeLength ? pasted : digits).substring(0, codeLength);
    }
    if (digits == newValue.text) return newValue;
    return TextEditingValue(text: digits, selection: TextSelection.collapsed(offset: digits.length));
  }

  /// The text that [next] adds to [prev]: what is left after the shared
  /// start and end are cut off.
  static String _inserted(String prev, String next) {
    var start = 0;
    while (start < prev.length && start < next.length && prev[start] == next[start]) {
      start++;
    }
    var end = 0;
    while (end < prev.length - start &&
        end < next.length - start &&
        prev[prev.length - 1 - end] == next[next.length - 1 - end]) {
      end++;
    }
    return next.substring(start, next.length - end);
  }
}

/// "Send a new code" with a 60 s countdown. The countdown starts on mount,
/// since the screen shows it right after a code was sent.
class ResendCodeButton extends StatefulWidget {
  const ResendCodeButton({super.key, required this.onResend});

  /// Throws to keep the countdown off (the caller shows the error).
  final Future<void> Function() onResend;

  @override
  State<ResendCodeButton> createState() => _ResendCodeButtonState();
}

class _ResendCodeButtonState extends State<ResendCodeButton> {
  static const _wait = 60;
  int _left = _wait;
  bool _busy = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    _timer?.cancel();
    setState(() => _left = _wait);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _left--);
      if (_left <= 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _resend() async {
    setState(() => _busy = true);
    try {
      await widget.onResend();
      if (mounted) _start();
    } catch (_) {
      // The caller reports it.
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => TextButton(
        onPressed: _left > 0 || _busy ? null : _resend,
        child: Text(_left > 0 ? 'Send a new code in ${_left}s' : 'Send a new code'),
      );
}

class SubmitButton extends StatelessWidget {
  const SubmitButton({super.key, required this.label, required this.busy, required this.onPressed});
  final String label;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => FilledButton(
        onPressed: busy ? null : onPressed,
        child: busy
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
            : Text(label),
      );
}
