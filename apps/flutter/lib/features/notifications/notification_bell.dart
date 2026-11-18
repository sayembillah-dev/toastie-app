import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/data.dart';
import '../../core/theme/tokens.dart';
import '../../ui/icons.dart';

/// Bell with the unread count, for screen headers. Opens the notifications
/// list.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final count = ref.watch(unreadNotificationsProvider).value ?? 0;
    return IconButton(
      tooltip: count > 0 ? 'Notifications, $count unread' : 'Notifications',
      onPressed: () => context.push('/notifications'),
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text(count > 99 ? '99+' : '$count'),
        backgroundColor: c.danger,
        child: Icon(PhosphorIconsRegular.bell, color: c.ink),
      ),
    );
  }
}
