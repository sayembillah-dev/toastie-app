import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toastie/app/email_gate.dart';
import 'package:toastie/app/router.dart';
import 'package:toastie/app/session.dart';
import 'package:toastie/core/api/api_client.dart';
import 'package:toastie/core/bd_time.dart';
import 'package:toastie/data/models.dart';
import 'package:toastie/data/toastie_api.dart';

/// Answers the two verify calls without a server.
class _FakeApi extends ToastieApi {
  _FakeApi() : super(ApiClient(TokenStore()));
  final sent = <String>[];

  @override
  Future<void> sendEmailCode(String email) async {
    if (email == 'taken@example.com') throw ApiError(409, 'bad', code: 'EMAIL_TAKEN');
    sent.add(email);
  }

  @override
  Future<Json> verifyEmail(String email, String code) async {
    if (code != '123456') throw ApiError(400, 'bad', code: 'OTP_INVALID');
    return {
      'user': {
        'id': 'u-1',
        'phone': '01700000000',
        'firstName': 'Rina',
        'lastName': 'Akter',
        'email': email,
        'emailVerified': true,
      },
    };
  }
}

Session _session({String? email, bool? emailVerified, bool mustVerify = false, bool mustChange = false}) =>
    Session.fromJson({
      'user': {
        'id': 'u-1',
        'phone': '01700000000',
        'firstName': 'Rina',
        'lastName': 'Akter',
        'email': ?email,
        'emailVerified': ?emailVerified,
        'mustVerifyEmail': mustVerify,
        'mustChangePassword': mustChange,
      },
    });

SignedIn _in({
  String? email,
  bool? emailVerified,
  bool mustVerify = false,
  bool mustChange = false,
  bool skipped = false,
}) => SignedIn(
  _session(email: email, emailVerified: emailVerified, mustVerify: mustVerify, mustChange: mustChange),
  null,
  skippedPasswordChange: skipped,
);

void main() {
  group('SessionUser.emailVerified', () {
    test('defaults to verified when the API does not send it', () {
      expect(_session(email: 'a@b.co').user.emailVerified, isTrue);
    });
    test('reads false', () {
      expect(_session(email: 'a@b.co', emailVerified: false).user.emailVerified, isFalse);
    });
  });

  group('shouldShowEmailGate', () {
    final unverified = _in(email: 'a@b.co', emailVerified: false);

    test('signed out never', () {
      expect(shouldShowEmailGate(const SignedOut(), '/'), isFalse);
    });
    test('unverified on app pages, /join and /me', () {
      for (final p in ['/', '/meetings/1/roles', '/join', '/me/password']) {
        expect(shouldShowEmailGate(unverified, p), isTrue, reason: p);
      }
    });
    test('not on public pages or the forced password change', () {
      for (final p in ['/sign-in', '/welcome', '/agenda/m1', '/invite/t', '/change-password']) {
        expect(shouldShowEmailGate(unverified, p), isFalse, reason: p);
      }
    });
    test('a pending temporary password comes first; once skipped, the prompt shows', () {
      final pending = _in(emailVerified: false, mustChange: true);
      expect(shouldShowEmailGate(pending, '/'), isFalse);
      final skipped = _in(emailVerified: false, mustChange: true, skipped: true);
      expect(shouldShowEmailGate(skipped, '/'), isTrue);
    });
    test('mustVerifyEmail alone shows it; a verified account does not', () {
      expect(shouldShowEmailGate(_in(email: 'a@b.co', mustVerify: true), '/'), isTrue);
      expect(shouldShowEmailGate(_in(email: 'a@b.co', emailVerified: true), '/'), isFalse);
      expect(shouldShowEmailGate(_in(email: 'a@b.co'), '/'), isFalse);
    });
  });

  test('normalizePhone', () {
    expect(normalizePhone(' +880 1712-345678 '), '01712345678');
    expect(normalizePhone('8801712345678'), '01712345678');
    expect(normalizePhone('01712345678'), '01712345678');
  });

  group('EmailGate widget', () {
    setUp(() {
      FlutterSecureStorage.setMockInitialValues({});
      SharedPreferences.setMockInitialValues({});
    });

    Future<GoRouter> pump(WidgetTester tester, AuthState auth, {ToastieApi? api}) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (_, _) => const Scaffold(body: Center(child: Text('HOME'))),
          ),
          GoRoute(
            path: '/other',
            builder: (_, _) => const Scaffold(body: Center(child: Text('OTHER'))),
          ),
          GoRoute(
            path: '/sign-in',
            builder: (_, _) => const Scaffold(body: Text('SIGN IN')),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            routerProvider.overrideWithValue(router),
            tokenStoreProvider.overrideWithValue(TokenStore()),
            initialAuthProvider.overrideWithValue(auth),
            if (api != null) apiProvider.overrideWithValue(api),
          ],
          child: Consumer(
            builder: (context, ref, _) => MaterialApp.router(
              routerConfig: ref.watch(routerProvider),
              builder: (context, child) => EmailGate(child: child!),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      return router;
    }

    testWidgets('no email: "Add your email" over the app', (tester) async {
      await pump(tester, _in(emailVerified: false));
      expect(find.text('HOME'), findsOneWidget);
      expect(find.text('Add your email'), findsOneWidget);
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Use a different email'), findsNothing);
      expect(find.text('Sign out'), findsOneWidget);
    });

    testWidgets('unverified email: shows it, and can switch to another', (tester) async {
      await pump(tester, _in(email: 'rina@example.com', emailVerified: false));
      expect(find.text('Verify your email'), findsOneWidget);
      expect(find.text('rina@example.com'), findsOneWidget);
      await tester.tap(find.text('Use a different email'));
      await tester.pumpAndSettle();
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Use rina@example.com instead'), findsOneWidget);
    });

    testWidgets('verified: nothing', (tester) async {
      await pump(tester, _in(email: 'rina@example.com', emailVerified: true));
      expect(find.text('HOME'), findsOneWidget);
      expect(find.text('Verify your email'), findsNothing);
    });

    testWidgets('back does nothing while it is up', (tester) async {
      final router = await pump(tester, _in(email: 'rina@example.com', emailVerified: false));
      router.push('/other');
      await tester.pumpAndSettle();
      expect(find.text('OTHER'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('OTHER'), findsOneWidget);
      expect(find.text('Verify your email'), findsOneWidget);
    });

    testWidgets('not on public pages', (tester) async {
      final router = await pump(tester, _in(email: 'rina@example.com', emailVerified: false));
      router.go('/sign-in');
      await tester.pumpAndSettle();
      expect(find.text('Verify your email'), findsNothing);
    });

    testWidgets('address on file: send code, verify, success, then the app', (tester) async {
      final api = _FakeApi();
      await pump(tester, _in(email: 'rina@example.com', emailVerified: false), api: api);

      expect(find.text('Current password'), findsNothing);
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();
      expect(api.sent, ['rina@example.com']);
      expect(find.text('Check your inbox'), findsOneWidget);
      expect(find.textContaining('Send a new code in'), findsOneWidget);

      await tester.enterText(find.byType(TextFormField), '000000');
      await tester.tap(find.text('Verify'));
      await tester.pumpAndSettle();
      expect(find.text('That code is wrong or has expired.'), findsOneWidget);

      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.pump();
      await tester.tap(find.text('Verify'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Email verified'), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      expect(find.text('Email verified'), findsNothing);
      expect(find.text('HOME'), findsOneWidget);
      // Let the resend countdown's timer finish.
      await tester.pump(const Duration(seconds: 61));
    });

    testWidgets('a different email: no password, inline error when taken', (tester) async {
      final api = _FakeApi();
      await pump(tester, _in(email: 'rina@example.com', emailVerified: false), api: api);
      await tester.tap(find.text('Use a different email'));
      await tester.pumpAndSettle();
      expect(find.byType(TextFormField), findsOneWidget);

      await tester.enterText(find.byType(TextFormField), 'taken@example.com');
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();
      expect(find.text('That email is already used by another account.'), findsOneWidget);

      await tester.enterText(find.byType(TextFormField), 'New@Example.com');
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();
      expect(api.sent, ['new@example.com']);
      expect(find.text('new@example.com'), findsOneWidget);
      await tester.pump(const Duration(seconds: 61));
    });

    testWidgets('add-email step fits a small phone with the keyboard open', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      addTearDown(tester.view.reset);

      await pump(tester, _in(emailVerified: false), api: _FakeApi());
      expect(find.text('Add your email'), findsOneWidget);
      await tester.dragUntilVisible(find.text('Sign out'), find.byType(SingleChildScrollView), const Offset(0, -80));
      expect(tester.takeException(), isNull);
    });

    testWidgets('a long address fits a small phone with the keyboard open', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      addTearDown(tester.view.reset);

      await pump(
        tester,
        _in(email: 'a.really.long.address.for.testing@example-domain.com', emailVerified: false),
        api: _FakeApi(),
      );
      await tester.ensureVisible(find.text('Send code'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Send code'));
      await tester.pumpAndSettle();
      expect(find.text('Check your inbox'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pump(const Duration(seconds: 61));
    });
  });
}
