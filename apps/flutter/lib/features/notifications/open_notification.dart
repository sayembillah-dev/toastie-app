import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';

/// Opening a notification: mark it read, switch to its club when that isn't
/// the active one, then go to its app route. A club the user has since left
/// can't be opened, and one with no app screen (tasks) says so — both get a
/// toast instead of a dead end.
Future<void> openNotification(BuildContext context, WidgetRef ref, AppNotification n) async {
  if (!n.read) {
    // The container, not `ref`: navigating below disposes the calling screen,
    // and its `ref` is dead by the time the request returns.
    final container = ProviderScope.containerOf(context, listen: false);
    unawaited(
      ref
          .read(apiProvider)
          .markNotificationRead(n.id)
          .then((_) => container.invalidate(unreadNotificationsProvider))
          .catchError((_) {}),
    );
  }

  final s = ref.read(signedInProvider);
  if (s == null) return;
  final clubId = n.clubId;
  final switching = clubId != null && s.context?.clubId != clubId;
  AppContext? target;
  if (switching) {
    for (final ctx in s.session.contexts) {
      if (ctx.kind == ContextKind.club && ctx.clubId == clubId) target = ctx;
    }
    if (target == null) {
      showToast(context, "You're no longer a member of ${n.clubName ?? 'that club'}, so this can't be opened.");
      return;
    }
  }

  final route = n.appRoute;
  if (route == null) {
    showToast(context, 'Open Openfloor on the web to see this one.');
    return;
  }
  if (target != null) await ref.read(authProvider.notifier).switchContext(target);
  if (context.mounted) context.go(route);
}
