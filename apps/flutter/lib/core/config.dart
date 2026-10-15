/// Build-time configuration, passed with `--dart-define`.
///
///   flutter run --dart-define=API_URL=https://openfloor.club
///
/// `API_URL` is the server origin; the `/api` prefix is normalised here so a
/// value that already ends in `/api` (or `/api/`) cannot produce `/api/api`.
class AppConfig {
  const AppConfig._();

  static const String _rawApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://openfloor.club',
  );

  /// Origin of the web app, used to build shareable public links (agenda,
  /// voting, evaluation, role pages). Defaults to the API origin because the
  /// production web and API share a host.
  static const String _rawWebUrl = String.fromEnvironment('WEB_URL');

  /// Ends in `/` so relative paths ("auth/login") resolve under `/api/`
  /// rather than replacing its last segment.
  static String get apiBaseUrl => '${_stripApi(_rawApiUrl)}/api/';

  static String get webOrigin =>
      _stripApi(_rawWebUrl.isNotEmpty ? _rawWebUrl : _rawApiUrl);

  static String _stripApi(String url) {
    var out = url.trim();
    while (out.endsWith('/')) {
      out = out.substring(0, out.length - 1);
    }
    if (out.endsWith('/api')) out = out.substring(0, out.length - 4);
    return out;
  }
}
