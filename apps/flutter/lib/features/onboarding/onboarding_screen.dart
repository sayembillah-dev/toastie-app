import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ---------------------------------------------------------------------------
// First-run flag
// ---------------------------------------------------------------------------

const _seenKey = 'onboarding_seen_v1';

/// Read before the first frame (see main.dart) so the router can send a
/// first-time visitor straight to /welcome.
Future<bool> loadOnboardingSeen() async {
  try {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_seenKey) ?? false;
  } catch (_) {
    return true; // never trap someone in onboarding because prefs failed
  }
}

/// Defaults to "seen" so tests and any un-overridden scope skip onboarding.
final initialOnboardingSeenProvider = Provider<bool>((ref) => true);

final onboardingSeenProvider = NotifierProvider<OnboardingController, bool>(OnboardingController.new);

class OnboardingController extends Notifier<bool> {
  @override
  bool build() => ref.watch(initialOnboardingSeenProvider);

  Future<void> markSeen() async {
    state = true;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool(_seenKey, true);
    } catch (_) {
      // Still skipped for this session.
    }
  }
}

// ---------------------------------------------------------------------------
// Palette (a branded moment: fixed in light and dark mode)
// ---------------------------------------------------------------------------

const _hero = Color(0xFF2B3A55);
const _ink = Color(0xFF1C1C1C);
const _inkSoft = Color(0xFF5C5C5C);
const _inkMuted = Color(0xFF8A8A8A);
const _panelBody = Color(0xFFB0B4BA);
const _dotIdle = Color(0xFF4A4D52);
const _line = Color(0xFFEBEBEB);
const _mint = Color(0xFF5EE0B8);
const _onMint = Color(0xFF0B2A20);
const _skip = Color(0xFFC9D2E3);

class _Page {
  const _Page(this.title, this.body);
  final String title;
  final String body;
}

const _pages = [
  _Page('Create agendas\neffortlessly.',
      'Start from a template, drop in speakers and roles, and the timings fall into place.'),
  _Page('Manage the\nmeeting live.',
      'Fill open roles, run the timer and take attendance from your phone while the meeting happens.'),
  _Page('Track progress\ntogether.',
      'See your own pathway at a glance and celebrate every member who levels up.'),
];

int get _last => _pages.length - 1;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Three-page first-run intro. Swipe or tap the arrow; every element is
/// driven by one continuous page value, so the whole screen tracks the finger
/// and settles on a spring.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> with TickerProviderStateMixin {
  /// Fractional page position. Bounds leave room for the edge rubber-band.
  late final AnimationController _page =
      AnimationController.unbounded(vsync: this)..addListener(_onPageTick);

  /// Gentle idle drift of the floating cards.
  late final AnimationController _float =
      AnimationController(vsync: this, duration: const Duration(seconds: 6));

  /// One-shot drop-in of the first cards, after the cold-start splash.
  late final AnimationController _enter =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  static const _spring = SpringDescription(mass: 1, stiffness: 190, damping: 25);

  int _index = 0;
  int _dragFrom = 0;
  bool _reduceMotion = false;
  bool _started = false;
  bool _leaving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (_started) return;
    _started = true;
    if (_reduceMotion) {
      _enter.value = 1;
    } else {
      _float.repeat();
      // The IntroSplash (~1.85 s) covers the first frames of a cold start;
      // drop the cards in as it fades away.
      Future.delayed(const Duration(milliseconds: 1450), () {
        if (mounted) _enter.forward();
      });
    }
  }

  @override
  void dispose() {
    _page.dispose();
    _float.dispose();
    _enter.dispose();
    super.dispose();
  }

  void _onPageTick() {
    final i = _page.value.round().clamp(0, _last);
    if (i != _index) {
      _index = i;
      HapticFeedback.selectionClick();
      setState(() {}); // semantics + back handling follow the settled page
    }
  }

  void _goTo(int target, {double velocity = 0}) {
    target = target.clamp(0, _last);
    if (_reduceMotion) {
      _page.value = target.toDouble();
      return;
    }
    _page.animateWith(SpringSimulation(_spring, _page.value, target.toDouble(), velocity));
  }

  // --- drag -----------------------------------------------------------------

  void _dragStart(DragStartDetails _) {
    _page.stop();
    _dragFrom = _page.value.round().clamp(0, _last);
  }

  void _dragUpdate(DragUpdateDetails d, double width) {
    var delta = -(d.primaryDelta ?? 0) / width;
    final v = _page.value;
    if ((v <= 0 && delta < 0) || (v >= _last && delta > 0)) delta *= 0.3; // rubber-band
    _page.value = v + delta;
  }

  void _dragEnd(DragEndDetails d, double width) {
    final velocity = -(d.primaryVelocity ?? 0) / width; // pages per second
    final v = _page.value;
    int target;
    if (velocity.abs() > 0.4) {
      target = velocity > 0 ? v.floor() + 1 : v.ceil() - 1;
    } else {
      target = v.round();
    }
    // One page per gesture, like a pager.
    target = target.clamp(_dragFrom - 1, _dragFrom + 1);
    _goTo(target, velocity: velocity);
  }

  // --- actions --------------------------------------------------------------

  Future<void> _finish() async {
    if (_leaving) return;
    _leaving = true;
    HapticFeedback.lightImpact();
    await ref.read(onboardingSeenProvider.notifier).markSeen();
    if (mounted) context.go('/sign-in');
  }

  void _next() => _index >= _last ? _finish() : _goTo(_index + 1);

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _goTo(_index - 1);
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light.copyWith(systemNavigationBarColor: _ink),
        child: Scaffold(
          backgroundColor: _hero,
          body: LayoutBuilder(builder: (context, box) {
            final width = box.maxWidth;
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              dragStartBehavior: DragStartBehavior.down,
              onHorizontalDragStart: _dragStart,
              onHorizontalDragUpdate: (d) => _dragUpdate(d, width),
              onHorizontalDragEnd: (d) => _dragEnd(d, width),
              child: AnimatedBuilder(
                animation: Listenable.merge([_page, _float, _enter]),
                builder: (context, _) => _layout(context, _page.value),
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _layout(BuildContext context, double p) {
    // 0 on pages 0–1, ramping to 1 as the last page arrives.
    final lastness = (p - (_last - 1)).clamp(0.0, 1.0);
    final backness = p.clamp(0.0, 1.0);

    return Column(children: [
      // Top bar
      SafeArea(
        bottom: false,
        child: SizedBox(
          height: 56,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(children: [
              _Fade(
                visible: backness,
                child: IconButton(
                  tooltip: 'Back',
                  onPressed: () => _goTo(_index - 1),
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                ),
              ),
              const Spacer(),
              _Fade(
                visible: 1 - lastness,
                child: TextButton(
                  onPressed: _finish,
                  style: TextButton.styleFrom(foregroundColor: _skip, minimumSize: const Size(64, 44)),
                  child: const Text('Skip', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
            ]),
          ),
        ),
      ),
      // Floating cards
      Expanded(
        child: ExcludeSemantics(
          child: MediaQuery.withNoTextScaling(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: FittedBox(
                child: SizedBox(
                  width: 360,
                  height: 380,
                  child: Stack(clipBehavior: Clip.none, children: [
                    for (var i = 0; i < _pages.length; i++)
                      if ((p - i).abs() < 1.15) ..._cardsFor(i, p - i),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
      // Dark slanted panel
      _Panel(
        page: p,
        index: _index,
        lastness: lastness,
        onNext: _next,
      ),
    ]);
  }

  /// Cards for page [i]; [t] is the signed distance from it (0 = centred).
  List<Widget> _cardsFor(int i, double t) {
    final cards = switch (i) {
      0 => _agendaCards,
      1 => _meetingCards,
      _ => _progressCards,
    };
    return [
      for (var k = 0; k < cards.length; k++) _placed(cards[k], t, k),
    ];
  }

  Widget _placed(_Floating c, double t, int order) {
    // Parallax: deeper cards travel further and lean harder as they leave.
    final travel = -t * 300 * c.depth;
    final fade = (1 - t.abs() * 1.25).clamp(0.0, 1.0);
    final lean = c.angle + t * 0.12 * c.depth;
    final scale = 1 - t.abs() * 0.1;

    // Drop-in on first show, staggered per card.
    final e = Curves.easeOutBack.transform(
        ((_enter.value - order * 0.14) / (1 - 0.28)).clamp(0.0, 1.0));
    final enterLift = (1 - e) * 60;
    final enterFade = ((_enter.value - order * 0.14) * 3).clamp(0.0, 1.0);

    final bob = _reduceMotion ? 0.0 : math.sin((_float.value + c.phase) * 2 * math.pi) * 5;

    return Positioned(
      left: c.left,
      top: c.top,
      child: Opacity(
        opacity: fade * enterFade,
        child: Transform.translate(
          offset: Offset(travel, bob + enterLift),
          child: Transform.rotate(
            angle: lean,
            child: Transform.scale(scale: scale, child: c.child),
          ),
        ),
      ),
    );
  }
}

/// Fades a control in/out and stops it taking taps while hidden.
class _Fade extends StatelessWidget {
  const _Fade({required this.visible, required this.child});
  final double visible;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final hidden = visible < 0.5;
    return IgnorePointer(
      ignoring: hidden,
      child: ExcludeSemantics(
        excluding: hidden,
        child: Opacity(opacity: visible.clamp(0.0, 1.0), child: child),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom panel
// ---------------------------------------------------------------------------

class _Panel extends StatelessWidget {
  const _Panel({required this.page, required this.index, required this.lastness, required this.onNext});

  final double page;
  final int index;
  final double lastness;
  final VoidCallback onNext;

  static const _slant = 56.0;

  @override
  Widget build(BuildContext context) {
    // The slant tips the other way on each page: 1 = left edge low.
    final tilt = 0.5 + 0.5 * math.cos(math.pi * page);

    return ClipPath(
      clipper: _SlantClipper(slant: _slant, leftLow: tilt),
      child: ColoredBox(
        color: _ink,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, _slant + 36, 28, 28),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // All three texts stacked; the Stack takes the tallest, so the
              // panel never jumps in height between pages.
              Stack(children: [
                for (var i = 0; i < _pages.length; i++) _text(i),
              ]),
              const SizedBox(height: 36),
              Row(children: [
                Semantics(
                  container: true,
                  label: 'Page ${index + 1} of ${_pages.length}',
                  child: ExcludeSemantics(child: Row(children: [for (var i = 0; i < _pages.length; i++) _dot(i)])),
                ),
                const Spacer(),
                _NextButton(lastness: lastness, isLast: index == _last, onTap: onNext),
              ]),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _text(int i) {
    final t = page - i;
    final fade = (1 - t.abs() * 1.8).clamp(0.0, 1.0);
    final current = i == index;
    return ExcludeSemantics(
      excluding: !current,
      child: Opacity(
        opacity: Curves.easeOut.transform(fade),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Transform.translate(
            offset: Offset(-t * 48, 0),
            child: Text(
              _pages[i].title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 32,
                height: 1.12,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.8,
              ),
            ),
          ),
          const SizedBox(height: 14),
          // Body trails the title a little, for depth.
          Transform.translate(
            offset: Offset(-t * 80, 0),
            child: Text(
              _pages[i].body,
              style: const TextStyle(color: _panelBody, fontSize: 15, height: 1.5),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _dot(int i) {
    final near = (1 - (page - i).abs()).clamp(0.0, 1.0);
    return Container(
      width: lerpDouble(6, 28, near),
      height: 6,
      margin: const EdgeInsets.only(right: 6),
      decoration: BoxDecoration(
        color: Color.lerp(_dotIdle, _mint, near),
        borderRadius: BorderRadius.circular(3),
      ),
    );
  }
}

class _SlantClipper extends CustomClipper<Path> {
  _SlantClipper({required this.slant, required this.leftLow});
  final double slant;
  final double leftLow;

  @override
  Path getClip(Size size) => Path()
    ..moveTo(0, slant * leftLow)
    ..lineTo(size.width, slant * (1 - leftLow))
    ..lineTo(size.width, size.height)
    ..lineTo(0, size.height)
    ..close();

  @override
  bool shouldReclip(_SlantClipper old) => old.leftLow != leftLow || old.slant != slant;
}

/// Mint circle with an arrow that grows into a "Get started" pill on the
/// last page.
class _NextButton extends StatelessWidget {
  const _NextButton({required this.lastness, required this.isLast, required this.onTap});
  final double lastness;
  final bool isLast;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final m = Curves.easeInOutCubic.transform(lastness);
    return Semantics(
      container: true,
      button: true,
      label: isLast ? 'Get started' : 'Next',
      excludeSemantics: true,
      child: SizedBox(
        width: lerpDouble(60, 168, m),
        height: 60,
        child: Material(
          color: _mint,
          shape: const StadiumBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Stack(alignment: Alignment.center, children: [
              Opacity(
                opacity: (1 - m * 2).clamp(0.0, 1.0),
                child: Transform.translate(
                  offset: Offset(m * 24, 0),
                  child: const Icon(Icons.arrow_forward_rounded, color: _ink, size: 24),
                ),
              ),
              Opacity(
                opacity: ((m - 0.45) * 2).clamp(0.0, 1.0),
                child: const Text(
                  'Get started',
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  softWrap: false,
                  style: TextStyle(color: _ink, fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Floating cards (decorative, laid out on a 360×380 stage)
// ---------------------------------------------------------------------------

class _Floating {
  const _Floating({
    required this.left,
    required this.top,
    required this.angle,
    required this.depth,
    required this.phase,
    required this.child,
  });
  final double left;
  final double top;
  final double angle; // radians
  final double depth; // parallax multiplier
  final double phase; // 0–1 offset into the idle drift
  final Widget child;
}

const _deg = math.pi / 180;

final _agendaCards = [
  _Floating(
    left: 24,
    top: 30,
    angle: -4 * _deg,
    depth: 0.8,
    phase: 0,
    child: _Card(
      width: 300,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const _Eyebrow('THURSDAY · 7:00 PM'),
        const SizedBox(height: 4),
        const Text('Meeting #214 agenda',
            style: TextStyle(color: _ink, fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 14),
        for (final (time, item) in const [
          ('7:00', 'Opening & welcome'),
          ('7:05', 'Table Topics'),
          ('7:20', 'Prepared speeches'),
          ('7:50', 'Evaluations'),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              SizedBox(
                width: 44,
                child: Text(time, style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w700)),
              ),
              Text(item, style: const TextStyle(color: _ink, fontSize: 13)),
            ]),
          ),
      ]),
    ),
  ),
  const _Floating(
    left: 150,
    top: 248,
    angle: 5 * _deg,
    depth: 1.35,
    phase: 0.35,
    child: _Chip(icon: Icons.check_rounded, label: 'Shared with 24 members'),
  ),
];

final _meetingCards = [
  _Floating(
    left: 16,
    top: 24,
    angle: -5 * _deg,
    depth: 0.75,
    phase: 0.1,
    child: _Card(
      width: 210,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const _Eyebrow('SPEAKER 2 · TIMER'),
        const SizedBox(height: 4),
        const Text('5:42',
            style: TextStyle(color: _ink, fontSize: 40, fontWeight: FontWeight.w800, letterSpacing: -1)),
        const SizedBox(height: 10),
        Row(children: [
          for (final c in const [Color(0xFF218358), Color(0xFFFFC53D), _line]) ...[
            Expanded(
              child: Container(
                height: 10,
                decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(5)),
              ),
            ),
            if (c != _line) const SizedBox(width: 8),
          ],
        ]),
      ]),
    ),
  ),
  _Floating(
    left: 124,
    top: 158,
    angle: 4 * _deg,
    depth: 1.1,
    phase: 0.45,
    child: _Card(
      width: 220,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const _Eyebrow("TONIGHT'S ROLES"),
        const SizedBox(height: 10),
        const _RoleRow('Toastmaster', 'Rahim'),
        const _RoleRow('Timer', 'Nadia'),
        Row(children: [
          const Text('Grammarian', style: TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w600)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: const Color(0xFFFFF4CC), borderRadius: BorderRadius.circular(6)),
            child: const Text('Open',
                style: TextStyle(color: Color(0xFF9E6C00), fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ]),
      ]),
    ),
  ),
  const _Floating(
    left: 36,
    top: 300,
    angle: -3 * _deg,
    depth: 1.45,
    phase: 0.75,
    child: _Chip(icon: Icons.how_to_reg_rounded, label: '18 checked in'),
  ),
];

final _progressCards = [
  _Floating(
    left: 30,
    top: 22,
    angle: -3 * _deg,
    depth: 0.8,
    phase: 0.2,
    child: _Card(
      width: 290,
      child: Row(children: [
        const SizedBox(width: 80, height: 80, child: CustomPaint(painter: _RingPainter(0.7))),
        const SizedBox(width: 18),
        Flexible(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
            _Eyebrow('YOUR PATH'),
            SizedBox(height: 4),
            Text('Level 3 of 5', style: TextStyle(color: _ink, fontSize: 18, fontWeight: FontWeight.w700)),
            SizedBox(height: 2),
            Text('2 speeches to go', style: TextStyle(color: _inkSoft, fontSize: 13)),
          ]),
        ),
      ]),
    ),
  ),
  _Floating(
    left: 96,
    top: 172,
    angle: 4 * _deg,
    depth: 1.1,
    phase: 0.55,
    child: _Card(
      width: 250,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
        _Eyebrow('CLUB THIS MONTH'),
        SizedBox(height: 12),
        _Bar('Speeches', 0.78),
        SizedBox(height: 10),
        _Bar('Roles', 0.56),
      ]),
    ),
  ),
  const _Floating(
    left: 30,
    top: 304,
    angle: -4 * _deg,
    depth: 1.45,
    phase: 0.85,
    child: _Chip(icon: Icons.emoji_events_rounded, label: 'Nadia completed Level 2'),
  ),
];

class _Card extends StatelessWidget {
  const _Card({required this.width, required this.child});
  final double width;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(color: Color(0x47000000), blurRadius: 40, offset: Offset(0, 16))],
        ),
        child: child,
      );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: _mint,
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [BoxShadow(color: Color(0x47000000), blurRadius: 40, offset: Offset(0, 16))],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 20, color: _onMint),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(color: _onMint, fontSize: 14, fontWeight: FontWeight.w700)),
        ]),
      );
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(color: _inkMuted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.8),
      );
}

class _RoleRow extends StatelessWidget {
  const _RoleRow(this.role, this.who);
  final String role;
  final String who;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(children: [
          Text(role, style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(who, style: const TextStyle(color: _inkSoft, fontSize: 13)),
        ]),
      );
}

class _Bar extends StatelessWidget {
  const _Bar(this.label, this.value);
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) => Row(children: [
        SizedBox(
          width: 72,
          child: Text(label, style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w600)),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: value,
              minHeight: 8,
              color: _ink,
              backgroundColor: _line,
            ),
          ),
        ),
      ]);
}

class _RingPainter extends CustomPainter {
  const _RingPainter(this.value);
  final double value;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 10.0;
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = _line;
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = _ink;
    canvas.drawArc(r, 0, 2 * math.pi, false, track);
    canvas.drawArc(r, -math.pi / 2, 2 * math.pi * value, false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value;
}
