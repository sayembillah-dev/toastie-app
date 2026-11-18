import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../features/notifications/open_notification.dart';
import 'data.dart';
import 'messenger.dart';
import 'session.dart';

/// Push notifications through Firebase Cloud Messaging (Android directly,
/// iOS via APNs). Null when Firebase couldn't start — every push feature
/// then quietly does nothing and the rest of the app is unaffected.
final pushProvider = Provider<PushNotifications?>((ref) => null);

const _kPrompted = 'push.permissionPrompted';

/// Registers this install's token with the API while someone is signed in,
/// opens the right screen when a notification is tapped, and shows a
/// snackbar for one that arrives while the app is open (the OS doesn't).
class PushNotifications {
  PushNotifications._();
  late final ProviderContainer _container;

  /// The account this install's token is registered to, so a context switch
  /// (a new `SignedIn` state) doesn't re-register.
  String? _registeredFor;
  String? _token;

  /// Starts Firebase. Null when it can't — e.g. a build missing its
  /// `google-services.json` / `GoogleService-Info.plist`.
  static Future<PushNotifications?> create() async {
    if (kIsWeb) return null;
    try {
      await Firebase.initializeApp();
      return PushNotifications._();
    } catch (e) {
      debugPrint('Push notifications off — Firebase did not start: $e');
      return null;
    }
  }

  FirebaseMessaging get _fcm => FirebaseMessaging.instance;

  /// Call once the first frame is up, so a cold-start tap can navigate.
  void start(ProviderContainer container) {
    _container = container;
    _container.listen<AuthState>(authProvider, (_, next) => _onAuth(next), fireImmediately: true);
    // The token calls below are deprecated in favour of installation IDs
    // (`register()`/`onRegistered`), but the API sends to registration
    // tokens; moving means changing the app and the server together.
    // ignore: deprecated_member_use
    _fcm.onTokenRefresh.listen((token) {
      _token = token;
      final userId = _container.read(signedInProvider)?.session.user.id;
      if (userId != null) unawaited(_send(token));
    });
    FirebaseMessaging.onMessage.listen(_onForeground);
    FirebaseMessaging.onMessageOpenedApp.listen(_onTapped);
    unawaited(_fcm.getInitialMessage().then((m) {
      if (m != null) _onTapped(m);
    }).catchError((_) {}));
  }

  /// Whether to show the "turn on notifications?" pre-prompt: never asked
  /// before, and not already allowed (Android below 13 always is).
  Future<bool> shouldAsk() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(_kPrompted) ?? false) return false;
      final settings = await _fcm.getNotificationSettings();
      return !_allowed(settings.authorizationStatus);
    } catch (_) {
      return false;
    }
  }

  /// Shows the system permission prompt, then registers when allowed.
  Future<bool> requestPermission() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_kPrompted, true);
      final settings = await _fcm.requestPermission();
      final ok = _allowed(settings.authorizationStatus);
      if (ok) await _register(force: true);
      return ok;
    } catch (_) {
      return false;
    }
  }

  Future<void> markAsked() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_kPrompted, true);
    } catch (_) {}
  }

  /// Sign-out on this phone: stop sending to it. Runs while the session is
  /// still valid; bounded so sign-out never hangs offline. If the API call
  /// fails, deleting the token at FCM still makes the server drop it on the
  /// next send.
  Future<void> unregister() async {
    final token = _token;
    _registeredFor = null;
    _token = null;
    if (token != null) {
      try {
        await _container.read(apiProvider).unregisterDevice(token).timeout(const Duration(seconds: 4));
      } catch (_) {}
    }
    try {
      // ignore: deprecated_member_use
      await _fcm.deleteToken().timeout(const Duration(seconds: 4));
    } catch (_) {}
  }

  void _onAuth(AuthState state) {
    if (state is! SignedIn) {
      _registeredFor = null;
      return;
    }
    if (_registeredFor == state.session.user.id) return;
    unawaited(_register());
  }

  /// Registers only when notifications are already allowed — asking is the
  /// pre-prompt's job, so this never pops a system dialog by itself.
  Future<void> _register({bool force = false}) async {
    final userId = _container.read(signedInProvider)?.session.user.id;
    if (userId == null) return;
    if (!force && _registeredFor == userId) return;
    try {
      final settings = await _fcm.getNotificationSettings();
      if (!_allowed(settings.authorizationStatus)) return;
      // ignore: deprecated_member_use
      final token = await _fcm.getToken();
      if (token == null) return;
      _token = token;
      await _send(token);
      _registeredFor = userId;
    } catch (e) {
      // iOS has no APNs token on a simulator or before the APNs key is set
      // up; the next launch tries again.
      debugPrint('Push registration failed: $e');
    }
  }

  Future<void> _send(String token) =>
      _container.read(apiProvider).registerDevice(platform: Platform.isIOS ? 'ios' : 'android', token: token);

  void _onForeground(RemoteMessage message) {
    _container.invalidate(unreadNotificationsProvider);
    final n = message.notification;
    if (n == null) return;
    showAppToast(
      [n.title, n.body].whereType<String>().join(' — '),
      action: message.data['route'] == null
          ? null
          : SnackBarAction(label: 'View', onPressed: () => _onTapped(message)),
    );
  }

  void _onTapped(RemoteMessage message) {
    // A tap while signed out (e.g. after sign-out on this phone) goes nowhere.
    if (_container.read(signedInProvider) == null) return;
    _container.invalidate(unreadNotificationsProvider);
    unawaited(openNotificationTarget(
      _container,
      route: message.data['route'] as String?,
      clubId: message.data['clubId'] as String?,
    ));
  }
}

bool _allowed(AuthorizationStatus s) =>
    s == AuthorizationStatus.authorized || s == AuthorizationStatus.provisional;
