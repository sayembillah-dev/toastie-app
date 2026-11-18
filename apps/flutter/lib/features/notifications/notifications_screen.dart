import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import 'open_notification.dart';

/// Every notification for the signed-in account, newest first, across all
/// their clubs. Pull to refresh; more pages load as the end scrolls in.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final List<AppNotification> _items = [];
  String? _cursor;
  bool _hasMore = true;
  bool _loading = false;
  Object? _error;
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _items.clear();
      _cursor = null;
      _hasMore = true;
      _error = null;
    });
    ref.invalidate(unreadNotificationsProvider);
    await _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final page = await ref.read(apiProvider).notifications(cursor: _cursor, unreadOnly: _unreadOnly);
      if (!mounted) return;
      setState(() {
        _items.addAll(page.items);
        _cursor = page.nextCursor;
        _hasMore = page.nextCursor != null;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(apiProvider).markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        if (_unreadOnly) {
          _items.clear();
          _hasMore = false;
        } else {
          for (var i = 0; i < _items.length; i++) {
            _items[i] = _items[i].copyWith(read: true);
          }
        }
      });
      ref.invalidate(unreadNotificationsProvider);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  void _open(AppNotification n) {
    if (!n.read) {
      setState(() {
        final i = _items.indexWhere((x) => x.id == n.id);
        if (i >= 0) _items[i] = n.copyWith(read: true);
      });
    }
    unawaited(openNotification(context, ref, n));
  }

  @override
  Widget build(BuildContext context) {
    final unread = ref.watch(unreadNotificationsProvider).value ?? 0;
    final multiClub = (ref.watch(signedInProvider)?.session.memberships.length ?? 0) > 1;

    Widget body;
    if (_items.isEmpty && _error != null) {
      body = ListView(
        children: [ErrorState(error: _error!, onRetry: _reload)],
      );
    } else if (_items.isEmpty && _loading) {
      body = const SingleChildScrollView(child: SkeletonList(height: 76));
    } else if (_items.isEmpty) {
      body = ListView(
        children: [
          EmptyState(
            icon: PhosphorIconsRegular.bell,
            title: _unreadOnly ? "You're all caught up" : 'No notifications yet',
            message: 'Role assignments, confirmed speeches, new meetings and tasks will show up here.',
          ),
        ],
      );
    } else {
      body = NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.extentAfter < 300) _loadMore();
          return false;
        },
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: Space.sm),
          itemCount: _items.length + (_hasMore ? 1 : 0),
          itemBuilder: (context, i) {
            if (i >= _items.length) {
              return const Padding(
                padding: EdgeInsets.all(Space.lg),
                child: Center(child: SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))),
              );
            }
            final n = _items[i];
            return _NotificationTile(notification: n, showClub: multiClub, onTap: () => _open(n));
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [TextButton(onPressed: unread > 0 ? _markAllRead : null, child: const Text('Mark all read'))],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, Space.sm, Space.gutter, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: false, label: Text('All')),
                  ButtonSegment(value: true, label: Text('Unread')),
                ],
                selected: {_unreadOnly},
                onSelectionChanged: (v) {
                  setState(() => _unreadOnly = v.first);
                  _reload();
                },
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(onRefresh: _reload, child: body),
          ),
        ],
      ),
    );
  }
}

const _typeIcons = <String, IconData>{
  'meeting.published': PhosphorIconsRegular.calendarPlus,
  'meeting.role_assigned': PhosphorIconsRegular.userPlus,
  'meeting.role_removed': PhosphorIconsRegular.userMinus,
  'meeting.speech_confirmed': PhosphorIconsRegular.microphone,
  'task.assigned': PhosphorIconsRegular.listChecks,
  'task.completed': PhosphorIconsRegular.checkCircle,
};

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.showClub, required this.onTap});
  final AppNotification notification;
  final bool showClub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final n = notification;
    final unread = !n.read;
    final meta = [
      formatNotificationTime(n.createdAt, DateTime.now()),
      if (showClub && n.clubName != null) n.clubName!,
    ].join(' · ');
    return Semantics(
      button: true,
      label: '${unread ? 'Unread. ' : ''}${n.title}. ${n.body}. $meta',
      excludeSemantics: true,
      child: Material(
        color: unread ? c.fill : Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: Space.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: c.surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: c.line),
                  ),
                  child: Icon(_typeIcons[n.type] ?? PhosphorIconsRegular.bell, size: 18, color: c.inkSoft),
                ),
                const SizedBox(width: Space.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        n.title,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: unread ? FontWeight.w600 : FontWeight.w500,
                          color: c.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        n.body,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13.5, color: c.inkSoft),
                      ),
                      const SizedBox(height: 4),
                      Text(meta, style: TextStyle(fontSize: 12, color: c.inkMuted)),
                    ],
                  ),
                ),
                if (unread)
                  Padding(
                    padding: const EdgeInsets.only(left: Space.sm, top: 6),
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: c.ink, shape: BoxShape.circle),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Just now", "5m ago", "3h ago", "2d ago", then "12 Nov".
String formatNotificationTime(DateTime at, DateTime now) {
  final d = now.difference(at);
  if (d.inMinutes < 1) return 'Just now';
  if (d.inHours < 1) return '${d.inMinutes}m ago';
  if (d.inDays < 1) return '${d.inHours}h ago';
  if (d.inDays < 7) return '${d.inDays}d ago';
  return DateFormat('d MMM', 'en_GB').format(at.toLocal());
}
