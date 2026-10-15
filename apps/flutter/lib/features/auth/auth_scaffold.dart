import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

/// Shared layout for sign-in / register: navy header with the logo, then a
/// scrolling form that stays clear of the keyboard.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({super.key, required this.title, required this.subtitle, required this.children});
  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [c.heroStart, c.heroEnd],
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.asset('assets/logo.png', width: 36, height: 36),
                      ),
                      const SizedBox(width: 10),
                      const Text('Open Floor',
                          style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                    ]),
                    const SizedBox(height: 36),
                    Text(title,
                        style: t.headlineLarge?.copyWith(color: Colors.white, fontSize: 30)),
                    const SizedBox(height: 6),
                    Text(subtitle,
                        style: t.bodyLarge?.copyWith(color: Colors.white.withValues(alpha: 0.75))),
                  ]),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            sliver: SliverList(delegate: SliverChildListDelegate(children)),
          ),
        ],
      ),
    );
  }
}

class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    this.hint = 'Enter your password',
    this.validator,
    this.textInputAction = TextInputAction.done,
    this.onSubmitted,
    this.autofillHints = const [AutofillHints.password],
  });
  final TextEditingController controller;
  final String hint;
  final String? Function(String?)? validator;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final Iterable<String> autofillHints;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _obscure,
      validator: widget.validator,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: widget.onSubmitted,
      autofillHints: widget.autofillHints,
      decoration: InputDecoration(
        hintText: widget.hint,
        prefixIcon: const Icon(Icons.lock_outline, size: 20),
        suffixIcon: IconButton(
          tooltip: _obscure ? 'Show password' : 'Hide password',
          icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
    );
  }
}
