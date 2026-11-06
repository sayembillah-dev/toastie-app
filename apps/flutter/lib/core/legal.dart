import 'package:url_launcher/url_launcher.dart';

import 'config.dart';

/// The public policy pages on the web app. Google Play checks that the privacy
/// policy is reachable from inside the app, not only from the store listing.
enum LegalPage {
  privacy('/privacy'),
  terms('/terms'),
  support('/support'),
  accountDeletion('/account-deletion');

  const LegalPage(this.path);
  final String path;

  Uri get uri => Uri.parse('${AppConfig.webOrigin}$path');
}

/// Opens [page] in the browser (an in-app tab where the platform has one).
Future<void> openLegalPage(LegalPage page) => launchUrl(page.uri, mode: LaunchMode.inAppBrowserView);
