import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../ui/icons.dart';

import '../core/access/access.dart';
import '../data/models.dart';
import '../ui/widgets.dart';
import 'session.dart';

class _Tab {
  const _Tab(this.branch, this.label, this.icon, this.selectedIcon);
  final int branch;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

const _home = _Tab(0, 'Home', PhosphorIconsRegular.house, PhosphorIconsFill.house);
const _meetings = _Tab(1, 'Meetings', PhosphorIconsRegular.calendarBlank, PhosphorIconsFill.calendarBlank);
const _people = _Tab(2, 'People', PhosphorIconsRegular.usersThree, PhosphorIconsFill.usersThree);
const _learn = _Tab(3, 'Learn', PhosphorIconsRegular.graduationCap, PhosphorIconsFill.graduationCap);
const _me = _Tab(4, 'Me', PhosphorIconsRegular.userCircle, PhosphorIconsFill.userCircle);
const _org = _Tab(5, 'Org tree', PhosphorIconsRegular.treeStructure, PhosphorIconsFill.treeStructure);
const _users = _Tab(6, 'Users', PhosphorIconsRegular.users, PhosphorIconsFill.users);

/// Bottom-navigation shell (PRD §3.1). Tabs the user can't read are hidden,
/// not removed — the branches stay registered so a deep link still lands on
/// a screen, which then shows "Access restricted".
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final can = ref.watch(canProvider);
    final ctx = ref.watch(signedInProvider)?.context;
    final isClub = ctx?.kind == ContextKind.club;
    final isOrg = ctx?.kind == ContextKind.org || ctx?.kind == ContextKind.global;

    final tabs = <_Tab>[
      _home,
      if (isClub && can(Act.read, 'meeting')) _meetings,
      if (isClub && (can(Act.read, 'guest') || can(Act.read, 'member'))) _people,
      if (isClub && can(Act.read, 'education')) _learn,
      if (isOrg) _org,
      if (ctx?.kind == ContextKind.global) _users,
      _me,
    ];
    var selected = tabs.indexWhere((t) => t.branch == shell.currentIndex);
    if (selected < 0) selected = 0;

    final client = ref.watch(apiClientProvider);

    return Scaffold(
      body: Column(children: [
        OfflineBanner(offline: client.offline),
        Expanded(child: shell),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (i) {
          HapticFeedback.selectionClick();
          final branch = tabs[i].branch;
          // Re-tapping the current tab pops it back to its root.
          shell.goBranch(branch, initialLocation: branch == shell.currentIndex);
        },
        destinations: [
          for (final t in tabs)
            NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.selectedIcon), label: t.label),
        ],
      ),
    );
  }
}

/// Shown when a deep link lands on a screen the user can't access.
class AccessRestricted extends StatelessWidget {
  const AccessRestricted({super.key, this.title = ''});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: const Center(
        child: EmptyState(
          icon: PhosphorIconsRegular.lockSimple,
          title: 'Access restricted',
          message: 'Your role in this club does not include this section. Ask a club officer if you need it.',
        ),
      ),
    );
  }
}
