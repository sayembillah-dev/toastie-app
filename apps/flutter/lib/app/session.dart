import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/access/access.dart';
import '../core/api/api_client.dart';
import '../data/models.dart';
import '../data/toastie_api.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => throw UnimplementedError('overridden in main'));
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(tokenStoreProvider)));
final apiProvider = Provider<ToastieApi>((ref) => ToastieApi(ref.watch(apiClientProvider)));

sealed class AuthState {
  const AuthState();
}

class SignedOut extends AuthState {
  const SignedOut({this.message});
  final String? message;
}

class SignedIn extends AuthState {
  const SignedIn(this.session, this.context, {this.skippedPasswordChange = false});
  final Session session;
  final AppContext? context;
  final bool skippedPasswordChange;

  SessionMembership? get membership => context?.membership;
  String? get clubId => context?.clubId;

  SignedIn copyWith({Session? session, AppContext? context, bool? skippedPasswordChange, bool clearContext = false}) =>
      SignedIn(
        session ?? this.session,
        clearContext ? null : (context ?? this.context),
        skippedPasswordChange: skippedPasswordChange ?? this.skippedPasswordChange,
      );
}

const _kSessionCache = 'toastie.session';

/// Initial auth state, resolved in `main()` while the native splash is up.
final initialAuthProvider = Provider<AuthState>((ref) => const SignedOut());

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final client = ref.read(apiClientProvider);
    client.onSessionExpired = () {
      if (state is SignedIn) {
        _clearLocal();
        state = const SignedOut(message: 'Your session expired. Please sign in again.');
      }
    };
    return ref.read(initialAuthProvider);
  }

  ToastieApi get _api => ref.read(apiProvider);
  TokenStore get _tokens => ref.read(tokenStoreProvider);

  /// Resolve the starting state from stored tokens. Only an auth failure
  /// wipes them — an unreachable server falls back to the cached session so
  /// the app still opens (read-only) in a room with no signal.
  static Future<AuthState> bootstrap(TokenStore tokens, ToastieApi api) async {
    await tokens.load();
    if (tokens.refreshToken == null && tokens.accessToken == null) return const SignedOut();
    try {
      final raw = await api.sessionRaw().timeout(const Duration(seconds: 10));
      await _cacheSessionRaw(raw);
      return _signedIn(Session.fromJson(raw), tokens);
    } on ApiError catch (e) {
      if (e.isAuth) {
        await tokens.clear();
        return const SignedOut();
      }
      final cached = await _readCachedSession();
      if (cached != null) return _signedIn(cached, tokens);
      return const SignedOut(message: "Can't reach the server. Check your connection and try again.");
    } catch (_) {
      final cached = await _readCachedSession();
      if (cached != null) return _signedIn(cached, tokens);
      return const SignedOut();
    }
  }

  static SignedIn _signedIn(Session session, TokenStore tokens) {
    final ctx = _pickContext(session, tokens.contextKey);
    tokens.contextKey = ctx?.key;
    return SignedIn(session, ctx);
  }

  /// Stored key → server default → first available. No context at all is a
  /// valid state: the user hasn't joined a club yet.
  static AppContext? _pickContext(Session s, String? stored) {
    final all = s.contexts;
    if (all.isEmpty) return null;
    for (final key in [stored, s.defaultContextKey]) {
      if (key == null) continue;
      final hit = all.where((c) => c.key == key);
      if (hit.isNotEmpty) return hit.first;
    }
    return all.first;
  }

  static Future<void> _cacheSessionRaw(Object? raw) async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_kSessionCache, jsonEncode(raw));
    } catch (_) {}
  }

  static Future<Session?> _readCachedSession() async {
    try {
      final p = await SharedPreferences.getInstance();
      final s = p.getString(_kSessionCache);
      if (s == null) return null;
      return Session.fromJson(Map<String, dynamic>.from(jsonDecode(s) as Map));
    } catch (_) {
      return null;
    }
  }

  Future<void> signIn(String phone, String password) async {
    final res = await _api.login(phone, password);
    await _applyAuthResult(res);
  }

  Future<void> register({required String name, required String phone, required String password, String? email}) async {
    final res = await _api.register(name: name, phone: phone, password: password, email: email);
    await _applyAuthResult(res);
  }

  Future<void> _applyAuthResult(Json res) async {
    final t = res['tokens'] as Map;
    await _tokens.saveTokens(t['accessToken'] as String, t['refreshToken'] as String);
    final session = Session.fromJson(Map<String, dynamic>.from(res['session'] as Map));
    final next = _signedIn(session, _tokens);
    await _tokens.saveContext(next.context?.key);
    await _cacheSessionRaw(res['session']);
    state = next;
  }

  /// Re-read the session (after joining a club, accepting an invite, a
  /// profile change, or a password change) and keep the current context if
  /// it is still held.
  Future<void> refreshSession() async {
    final current = state;
    final raw = await _api.sessionRaw();
    await _cacheSessionRaw(raw);
    final session = Session.fromJson(raw);
    final ctx = _pickContext(session, current is SignedIn ? current.context?.key : _tokens.contextKey);
    await _tokens.saveContext(ctx?.key);
    state = SignedIn(session, ctx,
        skippedPasswordChange: current is SignedIn && current.skippedPasswordChange);
  }

  Future<void> switchContext(AppContext ctx) async {
    final s = state;
    if (s is! SignedIn) return;
    await _tokens.saveContext(ctx.key);
    state = s.copyWith(context: ctx);
  }

  void skipPasswordChange() {
    final s = state;
    if (s is SignedIn) state = s.copyWith(skippedPasswordChange: true);
  }

  Future<void> signOut() async {
    await _api.logout();
    await _clearLocal();
    state = const SignedOut();
  }

  /// After the account is deleted server-side.
  Future<void> forgetLocally() async {
    await _clearLocal();
    state = const SignedOut();
  }

  Future<void> _clearLocal() async {
    await _tokens.clear();
    await ref.read(apiClientProvider).clearCache();
    try {
      final p = await SharedPreferences.getInstance();
      await p.remove(_kSessionCache);
    } catch (_) {}
  }
}

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

final signedInProvider = Provider<SignedIn?>((ref) {
  final s = ref.watch(authProvider);
  return s is SignedIn ? s : null;
});

/// The active context key. Every data provider watches this so that
/// switching clubs throws away the previous club's data.
final contextKeyProvider = Provider<String?>((ref) => ref.watch(signedInProvider)?.context?.key);

typedef CanFn = bool Function(Act action, String resource, {String? ownerMembershipId});

/// `can(action, resource)` against the active club by default — the same
/// contract as the web's `useCan`.
final canProvider = Provider<CanFn>((ref) {
  final s = ref.watch(signedInProvider);
  if (s == null) return (a, r, {ownerMembershipId}) => false;
  final subject = s.session.subject(s.context);
  final clubId = s.clubId;
  return (a, r, {ownerMembershipId}) => can(
        subject,
        a,
        r,
        Target(clubId: clubId, ownerMembershipId: ownerMembershipId),
      );
});

/// The signed-in member's membership id in the active club.
final myMembershipIdProvider = Provider<String?>((ref) => ref.watch(signedInProvider)?.membership?.membershipId);
