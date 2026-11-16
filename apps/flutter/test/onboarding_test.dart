import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toastie/features/onboarding/onboarding_screen.dart';

Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 20; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  Future<ProviderContainer> pumpIntro(WidgetTester t) async {
    SharedPreferences.setMockInitialValues({});
    // Real card copy is sized for the app font; the test font runs wider.
    final original = FlutterError.onError;
    FlutterError.onError = (d) {
      if (!d.exceptionAsString().contains('overflowed')) original?.call(d);
    };
    addTearDown(() => FlutterError.onError = original);
    final container = ProviderContainer(overrides: [
      initialOnboardingSeenProvider.overrideWithValue(false),
    ]);
    addTearDown(container.dispose);
    final router = GoRouter(initialLocation: '/welcome', routes: [
      GoRoute(path: '/welcome', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/sign-in', builder: (_, _) => const Scaffold(body: Text('SIGN IN'))),
    ]);
    await t.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    // Let the delayed card drop-in run.
    await t.pump(const Duration(seconds: 3));
    return container;
  }

  testWidgets('steps through all three pages and finishes', (t) async {
    final container = await pumpIntro(t);
    expect(find.bySemanticsLabel('Next'), findsOneWidget);

    await t.tap(find.bySemanticsLabel('Next'));
    await settle(t);
    await t.tap(find.bySemanticsLabel('Next'));
    await settle(t);

    expect(find.bySemanticsLabel('Get started'), findsOneWidget);
    await t.tap(find.bySemanticsLabel('Get started'));
    await settle(t);

    expect(find.text('SIGN IN'), findsOneWidget);
    expect(container.read(onboardingSeenProvider), isTrue);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('onboarding_seen_v1'), isTrue);
  });

  testWidgets('a swipe moves one page', (t) async {
    await pumpIntro(t);
    await t.fling(find.byType(OnboardingScreen), const Offset(-300, 0), 1500);
    await settle(t);
    expect(find.bySemanticsLabel('Page 2 of 3'), findsOneWidget);
  });

  testWidgets('Skip finishes from the first page', (t) async {
    final container = await pumpIntro(t);
    await t.tap(find.text('Skip'));
    await settle(t);
    expect(find.text('SIGN IN'), findsOneWidget);
    expect(container.read(onboardingSeenProvider), isTrue);
  });
}
