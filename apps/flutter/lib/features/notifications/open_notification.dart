import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/data.dart';
import '../../app/messenger.dart';
import '../../app/router.dart';
import '../../app/session.dart';
import '../../data/models.dart';

/// Tapping a notification in the in-app list: mark it read, then open it.
Future<void> openNotification(ProviderContainer container, AppNotification n) async {
  if (!n.read) {
    unawaited(container
        .read(apiProvider)
        .markNotificationRead(n.id)
        .then((_) => container.invalidate(unreadNotificationsProvider))
        .catchError((_) {}));
  }
  await openNotificationTarget(container, route: n.appRoute, clubId: n.clubId, clubName: n.clubName);
}

/// The one way into a notification's screen, shared by the in-app list and a
/// tapped push: switch to its club when that isn't the active one, then go to
/// [route]. A club the user has since left, or a notification with no app
/// screen (tasks), gets a toast instead of a dead end.
///
/// Takes the container, not a `WidgetRef`: navigating disposes the screen
/// that called it, and a push tap has no screen at all.
Future<void> openNotificationTarget(
  ProviderContainer container, {
  required String? route,
  String? clubId,
  String? clubName,
}) async {
  final s = container.read(signedInProvider);
  if (s == null) return;

  AppContext? target;
  if (clubId != null && s.context?.clubId != clubId) {
    for (final ctx in s.session.contexts) {
      if (ctx.kind == ContextKind.club && ctx.clubId == clubId) target = ctx;
    }
    if (target == null) {
      showAppToast("You're no longer a member of ${clubName ?? 'that club'}, so this can't be opened.");
      return;
    }
  }

  if (route == null) {
    showAppToast('Open Openfloor on the web to see this one.');
    return;
  }
  if (target != null) await container.read(authProvider.notifier).switchContext(target);
  container.read(routerProvider).go(route);
}
