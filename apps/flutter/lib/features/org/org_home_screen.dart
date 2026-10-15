import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/session.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/models_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import '../me/context_switcher.dart';
import 'org_tree_screen.dart';

/// Home for Director and Super Admin contexts.
class OrgHomeScreen extends ConsumerWidget {
  const OrgHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(signedInProvider)!;
    final ctx = s.context;
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final root = orgRootFor(ctx);
    final children = root == null ? null : ref.watch(orgListProvider(root)).value;
    final isGlobal = ctx?.kind == ContextKind.global;

    return Scaffold(
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Hi, ${s.session.user.firstName}', style: t.headlineLarge),
                  const SizedBox(height: 4),
                  Text(
                    [BdTime.todayHeader(DateTime.now()), ?ctx?.kindLabel].join(' · '),
                    style: t.bodyMedium?.copyWith(color: c.inkSoft),
                    overflow: TextOverflow.ellipsis,
                  ),
                ]),
              ),
              const SizedBox(width: Space.md),
              const ContextChip(),
            ]),
          ),
          if (root != null) ...[
            const SectionLabel('At a glance'),
            AppCard(
              onTap: () => context.go('/org'),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(children == null ? '—' : '${children.length}', style: t.headlineMedium),
                    Text(switch (root.level) {
                      OrgLevel.district => 'Districts',
                      OrgLevel.division => 'Divisions',
                      OrgLevel.area => 'Areas',
                      OrgLevel.club => 'Clubs',
                    }, style: t.bodySmall),
                  ]),
                ),
                const Chevron(),
              ]),
            ),
          ],
          const SectionLabel('Tools'),
          GroupCard(children: [
            RowTile(
              leading: const Icon(PhosphorIconsRegular.treeStructure),
              title: 'Org tree',
              subtitle: isGlobal ? 'Districts, divisions, areas and clubs' : 'Units and clubs you oversee',
              trailing: const Chevron(),
              onTap: () => context.go('/org'),
            ),
            if (isGlobal) ...[
              RowTile(
                leading: const Icon(PhosphorIconsRegular.users),
                title: 'Users',
                subtitle: 'Every account on the platform',
                trailing: const Chevron(),
                onTap: () => context.go('/users'),
              ),
              RowTile(
                leading: const Icon(PhosphorIconsRegular.whatsappLogo),
                title: 'WhatsApp',
                subtitle: 'The number Open Floor sends messages from',
                trailing: const Chevron(),
                onTap: () => context.push('/users/whatsapp'),
              ),
            ],
          ]),
          if (s.memberships.isNotEmpty) ...[
            const SectionLabel('Your clubs'),
            GroupCard(children: [
              for (final cx in s.session.contexts.where((x) => x.kind == ContextKind.club))
                RowTile(
                  leading: const Icon(PhosphorIconsRegular.buildings),
                  title: cx.label,
                  subtitle: 'Switch to this club',
                  trailing: const Chevron(),
                  onTap: () => ref.read(authProvider.notifier).switchContext(cx),
                ),
            ]),
          ],
        ]),
      ),
    );
  }
}

extension on SignedIn {
  List<SessionMembership> get memberships => session.memberships;
}
