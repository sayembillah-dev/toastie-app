import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

/// Normalised API failure. `fields` carries per-field validation messages
/// when the server sends them, so forms can pin errors to the right input.
class ApiError implements Exception {
  ApiError(this.status, this.message, {this.code, this.fields = const {}, this.body});

  final int status; // 0 = network
  final String message;
  final String? code;
  final Map<String, String> fields;
  final Object? body;

  bool get isNetwork => status == 0;
  bool get isAuth => status == 401;
  bool get isNotFound => status == 404;

  @override
  String toString() => message;

  static ApiError from(Object e) {
    if (e is ApiError) return e;
    if (e is DioException) {
      final res = e.response;
      if (res == null) {
        return ApiError(0, "Can't reach the server. Check your connection and try again.");
      }
      final data = res.data;
      var msg = 'Something went wrong (${res.statusCode}). Please try again.';
      String? code;
      var fields = <String, String>{};
      if (data is Map) {
        final m = data['message'];
        if (m is String && m.isNotEmpty) msg = m;
        if (m is List && m.isNotEmpty) msg = m.join('\n');
        code = data['code'] as String? ?? data['error'] as String?;
        if (data['fields'] is Map) {
          fields = (data['fields'] as Map).map((k, v) => MapEntry('$k', v is List ? v.join(', ') : '$v'));
        }
      }
      return ApiError(res.statusCode ?? 500, msg, code: code, fields: fields, body: data);
    }
    return ApiError(-1, e.toString());
  }
}

/// Persists tokens in the platform keychain/keystore. iOS uses
/// `first_unlock` accessibility so a push-triggered cold start can read them.
class TokenStore {
  TokenStore() : _storage = const FlutterSecureStorage(
          iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
        );

  final FlutterSecureStorage _storage;
  static const _kAccess = 'toastie.accessToken';
  static const _kRefresh = 'toastie.refreshToken';
  static const _kContext = 'toastie.activeContext';

  String? accessToken;
  String? refreshToken;
  String? contextKey;

  Future<void> load() async {
    try {
      accessToken = await _storage.read(key: _kAccess);
      refreshToken = await _storage.read(key: _kRefresh);
      contextKey = await _storage.read(key: _kContext);
    } catch (_) {
      // Keychain can throw after a restore from backup — treat as signed out.
    }
  }

  Future<void> saveTokens(String access, String refresh) async {
    accessToken = access;
    refreshToken = refresh;
    try {
      await _storage.write(key: _kAccess, value: access);
      await _storage.write(key: _kRefresh, value: refresh);
    } catch (_) {}
  }

  Future<void> saveContext(String? key) async {
    contextKey = key;
    try {
      if (key == null) {
        await _storage.delete(key: _kContext);
      } else {
        await _storage.write(key: _kContext, value: key);
      }
    } catch (_) {}
  }

  Future<void> clear() async {
    accessToken = null;
    refreshToken = null;
    contextKey = null;
    try {
      await _storage.deleteAll();
    } catch (_) {}
  }
}

/// HTTP client for the Toastie API.
///
/// - Bearer token + `X-Toastly-Context` on every request.
/// - On 401: one **single-flight** refresh shared by every concurrent caller
///   (refresh tokens rotate; replaying one revokes the whole family and logs
///   out every device), then one retry of the original request.
/// - GETs are cached per context so the last-seen data can be shown offline.
class ApiClient {
  ApiClient(this.tokens) {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final anon = options.extra['anonymous'] == true;
        if (!anon) {
          final t = tokens.accessToken;
          if (t != null) options.headers['Authorization'] = 'Bearer $t';
          final ctx = tokens.contextKey;
          if (ctx != null) options.headers['X-Toastly-Context'] = ctx;
        }
        handler.next(options);
      },
      onError: (err, handler) async {
        final req = err.requestOptions;
        final is401 = err.response?.statusCode == 401;
        final canRefresh = is401 &&
            req.extra['anonymous'] != true &&
            req.extra['retried'] != true &&
            !req.path.contains('auth/refresh') &&
            !req.path.contains('auth/login') &&
            tokens.refreshToken != null;
        if (!canRefresh) return handler.next(err);
        final ok = await _refresh();
        if (!ok) {
          onSessionExpired?.call();
          return handler.next(err);
        }
        try {
          req.extra['retried'] = true;
          req.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
          final res = await _dio.fetch<dynamic>(req);
          handler.resolve(res);
        } on DioException catch (e) {
          handler.next(e);
        }
      },
    ));
  }

  final TokenStore tokens;
  late final Dio _dio;
  Future<bool>? _refreshing;

  /// Called when refresh fails — the session controller signs the user out.
  VoidCallback? onSessionExpired;

  /// True while the app is serving cached data because the network failed.
  final ValueNotifier<bool> offline = ValueNotifier(false);

  Future<bool> _refresh() {
    return _refreshing ??= () async {
      try {
        final res = await _dio.post<dynamic>(
          'auth/refresh',
          data: {'refreshToken': tokens.refreshToken},
          options: Options(extra: {'anonymous': true}),
        );
        final data = res.data as Map;
        final t = (data['tokens'] ?? data) as Map;
        await tokens.saveTokens(t['accessToken'] as String, t['refreshToken'] as String);
        return true;
      } catch (_) {
        return false;
      } finally {
        // Let the next 401 start a fresh refresh once this one settles.
        Future<void>.delayed(Duration.zero, () => _refreshing = null);
      }
    }();
  }

  String _cacheKey(String path, Map<String, dynamic>? q) =>
      'cache:${tokens.contextKey ?? 'none'}:$path${q == null || q.isEmpty ? '' : '?${Uri(queryParameters: q.map((k, v) => MapEntry(k, '$v'))).query}'}';

  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool anonymous = false, bool cache = true}) async {
    try {
      final res = await _dio.get<dynamic>(path,
          queryParameters: query, options: Options(extra: {'anonymous': anonymous}));
      if (offline.value) offline.value = false;
      if (cache) unawaited(_writeCache(_cacheKey(path, query), res.data));
      return res.data;
    } catch (e) {
      final err = ApiError.from(e);
      if (err.isNetwork && cache) {
        final cached = await _readCache(_cacheKey(path, query));
        if (cached != null) {
          offline.value = true;
          return cached;
        }
      }
      throw err;
    }
  }

  Future<dynamic> post(String path, {Object? body, bool anonymous = false}) =>
      _send('POST', path, body, anonymous);
  Future<dynamic> patch(String path, {Object? body}) => _send('PATCH', path, body, false);
  Future<dynamic> put(String path, {Object? body}) => _send('PUT', path, body, false);
  Future<dynamic> delete(String path, {Object? body}) => _send('DELETE', path, body, false);

  Future<dynamic> _send(String method, String path, Object? body, bool anonymous) async {
    try {
      final res = await _dio.request<dynamic>(
        path,
        data: body,
        options: Options(
          method: method,
          contentType: body == null ? null : 'application/json',
          extra: {'anonymous': anonymous},
        ),
      );
      if (offline.value) offline.value = false;
      return res.data;
    } catch (e) {
      throw ApiError.from(e);
    }
  }

  Future<void> _writeCache(String key, Object? data) async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(key, jsonEncode(data));
    } catch (_) {}
  }

  Future<dynamic> _readCache(String key) async {
    try {
      final p = await SharedPreferences.getInstance();
      final s = p.getString(key);
      return s == null ? null : jsonDecode(s);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearCache() async {
    try {
      final p = await SharedPreferences.getInstance();
      for (final k in p.getKeys().where((k) => k.startsWith('cache:'))) {
        await p.remove(k);
      }
    } catch (_) {}
  }
}
