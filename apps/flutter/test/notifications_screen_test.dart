import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/app/data.dart';
import 'package:toastie/app/session.dart';
import 'package:toastie/core/api/api_client.dart';
import 'package:toastie/core/theme/app_theme.dart';
import 'package:toastie/data/models.dart';
import 'package:toastie/data/toastie_api.dart';
import 'package:toastie/features/notifications/notifications_screen.dart';

AppNotification _n(String id, {bool read = false}) => AppNotification(
  id: id,
  type: 'meeting.published',
  title: 'Title $id',
  body: 'Body $id',
  read: read,
  createdAt: DateTime.now(),
);

/// Each list call waits on a completer the test resolves, so the order in
/// which responses arrive can be controlled.
class _FakeApi extends ToastieApi {
  _FakeApi() : super(ApiClient(TokenStore()));
  final calls = <({bool unreadOnly, Completer<NotificationPage> done})>[];

  @override
  Future<NotificationPage> notifications({String? cursor, bool unreadOnly = false, int limit = 20}) {
    final done = Completer<NotificationPage>();
    calls.add((unreadOnly: unreadOnly, done: done));
    return done.future;
  }
}

Future<_FakeApi> _pump(WidgetTester tester) async {
  final api = _FakeApi();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiProvider.overrideWithValue(api),
        signedInProvider.overrideWithValue(null),
        unreadNotificationsProvider.overrideWith((ref) async => 1),
      ],
      // Like the real app: the header bell is already watching the badge
      // count when the screen is opened from it.
      child: MaterialApp(
        theme: AppTheme.light(),
        home: Consumer(
          builder: (context, ref, _) {
            ref.watch(unreadNotificationsProvider);
            return Scaffold(
              body: TextButton(
                onPressed: () =>
                    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const NotificationsScreen())),
                child: const Text('bell'),
              ),
            );
          },
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('bell'));
  await tester.pump();
  // Let the page transition finish; the loading skeleton shimmers forever,
  // so pumpAndSettle can't be used while a request is pending.
  await tester.pump(const Duration(milliseconds: 600));
  return api;
}

void main() {
  testWidgets('"All" loads on first open instead of showing empty', (tester) async {
    final api = await _pump(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('No notifications yet'), findsNothing, reason: 'must not claim empty while loading');

    expect(api.calls, hasLength(1));
    expect(api.calls.single.unreadOnly, isFalse);
    api.calls.single.done.complete(NotificationPage(items: [_n('a', read: true), _n('b')]));
    await tester.pumpAndSettle();
    expect(find.text('Title a'), findsOneWidget);
    expect(find.text('Title b'), findsOneWidget);
  });

  testWidgets('a late "All" response is not mixed into "Unread"', (tester) async {
    final api = await _pump(tester);

    // Switch to Unread before the All page arrives.
    await tester.tap(find.text('Unread'));
    await tester.pump();
    expect(api.calls, hasLength(2));
    expect(api.calls.last.unreadOnly, isTrue);

    api.calls.first.done.complete(NotificationPage(items: [_n('old', read: true)]));
    api.calls.last.done.complete(NotificationPage(items: [_n('new')]));
    await tester.pumpAndSettle();

    expect(find.text('Title new'), findsOneWidget);
    expect(find.text('Title old'), findsNothing);
  });
}
