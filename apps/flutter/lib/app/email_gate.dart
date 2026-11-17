import 'dart:ui' show ImageFilter;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/verify_email_card.dart';
import 'router.dart';
import 'session.dart';

/// Whether the blocking "verify your email" prompt belongs over [path].
///
/// It shows for a signed-in account whose email is not verified (or that the
/// server says must verify), but never on the public pages, and never while
/// the forced temporary-password change is still pending — that comes first.
bool shouldShowEmailGate(AuthState auth, String path) {
  if (auth is! SignedIn) return false;
  final user = auth.session.user;
  if (user.emailVerified && !user.mustVerifyEmail) return false;
  if (user.mustChangePassword && !auth.skippedPasswordChange) return false;
  if (path == '/change-password') return false;
  return !publicRoutePrefixes.any(path.startsWith);
}

/// Sits between `MaterialApp.router` and its navigator. When
/// [shouldShowEmailGate] holds, it dims and blurs the app and stacks the
/// verify-email card on top. Nothing behind can be tapped, focused or popped:
/// the only ways out are verifying or signing out.
class EmailGate extends ConsumerStatefulWidget {
  const EmailGate({super.key, required this.child});

  /// The app's navigator. Always kept at the same place in the tree so its
  /// pages survive the prompt opening and closing.
  final Widget child;

  @override
  ConsumerState<EmailGate> createState() => _EmailGateState();
}

class _EmailGateState extends ConsumerState<EmailGate> {
  late final GoRouter _router = ref.read(routerProvider);
  late String _path = _currentPath;
  ChildBackButtonDispatcher? _back;
  bool _blocking = false;

  String get _currentPath => _router.routerDelegate.currentConfiguration.uri.path;

  @override
  void initState() {
    super.initState();
    _router.routerDelegate.addListener(_onRoute);
  }

  @override
  void dispose() {
    _router.routerDelegate.removeListener(_onRoute);
    _releaseBack();
    super.dispose();
  }

  /// The router can notify mid-build (while the navigator builds), so a
  /// change seen then is applied once that frame is done.
  void _onRoute() {
    if (_currentPath == _path) return;
    final binding = SchedulerBinding.instance;
    if (binding.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      binding.addPostFrameCallback((_) {
        if (mounted && _currentPath != _path) setState(() => _path = _currentPath);
      });
    } else {
      setState(() => _path = _currentPath);
    }
  }

  Future<bool> _swallowBack() => SynchronousFuture(true);

  /// Android back does nothing while the prompt is up — not even leave the app.
  void _syncBack(bool block) {
    _blocking = block;
    if (block == (_back != null)) return;
    if (!block) return _releaseBack();
    // After the frame, so the router has registered its own callback first.
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _back != null || !_blocking) return;
      final d = _router.backButtonDispatcher.createChildBackButtonDispatcher();
      d.addCallback(_swallowBack);
      d.takePriority();
      _back = d;
    });
  }

  void _releaseBack() {
    final d = _back;
    if (d == null) return;
    _back = null;
    d.removeCallback(_swallowBack);
    d.parent.forget(d);
  }

  @override
  Widget build(BuildContext context) {
    final show = shouldShowEmailGate(ref.watch(authProvider), _path);
    _syncBack(show);
    return Stack(
      fit: StackFit.expand,
      children: [
        ExcludeFocus(excluding: show, child: widget.child),
        // The layer fades in and out; the card keeps its state while shown.
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 260),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          layoutBuilder: (current, previous) => Stack(fit: StackFit.expand, children: [...previous, ?current]),
          child: show ? const _GateLayer(key: ValueKey('email-gate')) : const SizedBox.shrink(),
        ),
      ],
    );
  }
}

class _GateLayer extends StatelessWidget {
  const _GateLayer({super.key});

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.viewInsetsOf(context);
    // An Overlay of its own: text selection handles and tooltips need one,
    // and this layer sits above the navigator's.
    return BlockSemantics(
      child: Overlay.wrap(
        child: Material(
          type: MaterialType.transparency,
          child: Stack(
            fit: StackFit.expand,
            children: [
              BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                child: ModalBarrier(dismissible: false, color: Colors.black.withValues(alpha: 0.5)),
              ),
              Padding(
                padding: EdgeInsets.only(bottom: insets.bottom),
                child: SafeArea(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: const _CardEntrance(child: VerifyEmailCard()),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The card rises a few pixels and settles as the layer fades in.
class _CardEntrance extends StatelessWidget {
  const _CardEntrance({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: 1),
    duration: const Duration(milliseconds: 380),
    curve: Curves.easeOutCubic,
    child: child,
    builder: (context, t, child) => Transform.translate(
      offset: Offset(0, 16 * (1 - t)),
      child: Transform.scale(scale: 0.97 + 0.03 * t, child: child),
    ),
  );
}
