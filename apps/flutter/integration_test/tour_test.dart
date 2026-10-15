// Read-only screen tour against a real API. Signs in, walks every main
// screen and saves screenshots. It never creates, edits or deletes data.
//
//   flutter drive --driver=test_driver/integration_test.dart \
//     --target=integration_test/tour_test.dart \
//     --dart-define=TOUR_PHONE=01XXXXXXXXX --dart-define=TOUR_PASSWORD=...
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:toastie/features/meetings/meeting_common.dart';
import 'package:toastie/main.dart' as app;

const _phone = String.fromEnvironment('TOUR_PHONE');
const _password = String.fromEnvironment('TOUR_PASSWORD');

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // The home countdown ticks every second, so pumpAndSettle would never
  // settle — pump for a fixed time instead (network calls are real).
  Future<void> wait(WidgetTester t, [int ms = 3000]) async {
    for (var i = 0; i < ms ~/ 100; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> shot(String name) => binding.takeScreenshot(name);

  Future<void> back(WidgetTester t) async {
    final nav = t.state<NavigatorState>(find.byType(Navigator).last);
    nav.maybePop();
    await wait(t, 1500);
  }

  testWidgets('screen tour', (t) async {
    expect(_phone.isNotEmpty && _password.isNotEmpty, isTrue, reason: 'pass TOUR_PHONE / TOUR_PASSWORD');
    app.main();
    await wait(t, 4000);
    await shot('01-sign-in');

    // A previous run may have left a session in the keychain — that's the
    // restore path working, so only sign in when the form is showing.
    if (find.text('Welcome back — enter your details to continue.').evaluate().isNotEmpty) {
      await t.enterText(find.byType(TextFormField).at(0), _phone);
      await t.enterText(find.byType(TextFormField).at(1), _password);
      await t.tap(find.text('Sign in').last);
      await wait(t, 6000);
    }

    if (find.text('Skip for now').evaluate().isNotEmpty) {
      await shot('02-temporary-password');
      await t.tap(find.text('Skip for now'));
      await wait(t, 6000);
    }
    await shot('03-home');
    await t.drag(find.byType(Scrollable).first, const Offset(0, -700));
    await wait(t, 1500);
    await shot('04-home-scrolled');

    await t.tap(find.text('Meetings').last);
    await wait(t, 4000);
    await shot('05-meetings');

    await t.tap(find.byType(MeetingCard).first);
    await wait(t, 5000);
    await shot('06-meeting-hub');

    for (final (label, name) in [
      ('Roles', '07-roles'),
      ('Prepared Speakers', '08-speakers'),
      ('Theme', '09-theme'),
      ('Overview', '10-overview'),
      ('Agenda', '11-agenda'),
      ('Timer', '12-timer'),
      ('Ah Counter', '13-ah-counter'),
      ('Grammarian', '14-grammarian'),
    ]) {
      await t.ensureVisible(find.text(label).last);
      await wait(t, 500);
      await t.tap(find.text(label).last);
      await wait(t, 4000);
      await shot(name);
      await back(t);
    }

    await t.tap(find.text('People').last);
    await wait(t, 4000);
    await shot('15-people-guests');
    final guestRows = find.byType(Dismissible);
    if (guestRows.evaluate().isNotEmpty) {
      await t.tap(guestRows.first);
      await wait(t, 4000);
      await shot('16-guest-profile');
      await back(t);
    }

    await t.tap(find.text('Learn').last);
    await wait(t, 4000);
    await shot('17-learn');

    await t.tap(find.text('Me').last);
    await wait(t, 5000);
    await shot('18-me');
  });
}
