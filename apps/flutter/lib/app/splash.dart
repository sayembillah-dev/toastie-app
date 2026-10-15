import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Matches `flutter_native_splash.color` in pubspec.yaml, so the hand-off
/// from the native launch screen is seamless.
const _nativeColor = Color(0xFF1B2740);
const _heroStart = Color(0xFF2B3A55);
const _heroEnd = Color(0xFF111A2E);
const _mint = Color(0xFF5EE0B8);

/// Logo tile at the same size the native splash draws it (600 px @4x).
const _tileSize = 150.0;

/// Cold-start intro played over the app's first screen: mint "voice" rings
/// ripple out of the logo, the wordmark rises in, then the whole layer fades
/// away to reveal the app underneath. ~1.8 s; a tap skips it, and it's a
/// quick fade when the system asks for reduced motion.
class IntroSplash extends StatefulWidget {
  const IntroSplash({super.key, required this.child});
  final Widget child;

  @override
  State<IntroSplash> createState() => _IntroSplashState();
}

class _IntroSplashState extends State<IntroSplash> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1850));
  bool _done = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _c.value = 0.8; // straight to the hold, then the fade
    }
    // A status listener rather than the forward() future: skipping starts a
    // new animation, which cancels that future without completing it.
    _c.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted && !_done) setState(() => _done = true);
    });
    _c.forward();
  }

  void _skip() {
    if (_c.value < 0.81) _c.animateTo(1, duration: const Duration(milliseconds: 300));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return widget.child;
    return Stack(children: [
      widget.child,
      Positioned.fill(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _skip,
          child: AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.light,
            // Sits above the Navigator, outside any Material: give text a
            // real default style (no debug underline).
            child: Material(
              type: MaterialType.transparency,
              child: AnimatedBuilder(animation: _c, builder: (context, _) => _frame(_c.value)),
            ),
          ),
        ),
      ),
    ]);
  }

  /// [t] runs 0→1 over the whole intro.
  Widget _frame(double t) {
    double seg(double a, double b, [Curve curve = Curves.easeOutCubic]) =>
        curve.transform(((t - a) / (b - a)).clamp(0.0, 1.0));

    final gradientIn = seg(0, 0.15, Curves.easeOut);
    final pop = math.sin(seg(0.05, 0.3, Curves.easeInOut) * math.pi) * 0.06;
    final lift = seg(0.28, 0.55);
    final words = seg(0.36, 0.62);
    final exit = seg(0.82, 1, Curves.easeInCubic);

    return Opacity(
      opacity: 1 - exit,
      child: DecoratedBox(
        decoration: const BoxDecoration(color: _nativeColor),
        child: Stack(fit: StackFit.expand, children: [
          Opacity(
            opacity: gradientIn,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(center: Alignment(0, -0.15), radius: 1.1, colors: [_heroStart, _heroEnd]),
              ),
            ),
          ),
          Center(
            child: Transform.translate(
              offset: Offset(0, -44 * lift),
              child: Transform.scale(
                scale: 1 + pop + exit * 0.12,
                child: SizedBox(
                  width: _tileSize,
                  height: _tileSize,
                  child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
                    CustomPaint(size: const Size.square(_tileSize), painter: _RingsPainter(t)),
                    Image.asset('assets/splash/splash_logo.png', width: _tileSize, height: _tileSize),
                  ]),
                ),
              ),
            ),
          ),
          Center(
            child: Transform.translate(
              offset: Offset(0, 74 + 18 * (1 - words)),
              child: Opacity(
                opacity: words,
                child: const Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(
                    'Open Floor',
                    style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: 0.3),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'TOASTMASTERS CLUB OPERATIONS',
                    style: TextStyle(color: _mint, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 2.4),
                  ),
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// Three mint rings that spread out from behind the logo tile and fade, like
/// a voice carrying across the room.
class _RingsPainter extends CustomPainter {
  _RingsPainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    const start = _tileSize * 0.36;
    const end = _tileSize * 1.7;
    for (var i = 0; i < 3; i++) {
      final p = ((t - 0.08 - i * 0.12) / 0.55).clamp(0.0, 1.0);
      if (p <= 0 || p >= 1) continue;
      final eased = Curves.easeOutCubic.transform(p);
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5 * (1 - eased) + 0.5
        ..color = _mint.withValues(alpha: 0.55 * (1 - eased));
      canvas.drawCircle(center, start + (end - start) * eased, paint);
    }
  }

  @override
  bool shouldRepaint(_RingsPainter old) => old.t != t;
}
