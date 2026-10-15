import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/session.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';

/// Top-right pill naming the current context. When there's more than one to
/// pick from it's outlined with a caret and opens [showContextSwitcher];
/// otherwise it's a plain label.
class ContextChip extends ConsumerWidget {
  const ContextChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(signedInProvider);
    final ctx = s?.context;
    if (s == null || ctx == null) return const SizedBox.shrink();
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final canSwitch = s.session.contexts.length > 1;
    final label = Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(
        switch (ctx.kind) {
          ContextKind.club => PhosphorIconsRegular.buildings,
          ContextKind.org => PhosphorIconsRegular.treeStructure,
          ContextKind.global => PhosphorIconsRegular.shieldCheck,
        },
        size: 16,
        color: c.ink,
      ),
      const SizedBox(width: 6),
      Flexible(
        child: Text(ctx.label,
            style: t.labelLarge?.copyWith(color: c.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      if (canSwitch) ...[
        const SizedBox(width: 4),
        Icon(PhosphorIconsBold.caretDown, size: 14, color: c.ink),
      ],
    ]);
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.5),
      child: !canSwitch
          ? Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: label)
          : Semantics(
              button: true,
              label: 'Switch context, current: ${ctx.label}',
              excludeSemantics: true,
              child: Material(
                color: c.surface,
                shape: StadiumBorder(side: BorderSide(color: c.line)),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => showContextSwitcher(context, ref),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 40),
                    child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: label),
                  ),
                ),
              ),
            ),
    );
  }
}

/// Bottom sheet listing every context the user can act in (PRD §2.3).
Future<void> showContextSwitcher(BuildContext context, WidgetRef ref) async {
  final s = ref.read(signedInProvider);
  if (s == null) return;
  final contexts = s.session.contexts;
  await showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (ctx) {
      final c = AppColors.of(ctx);
      final t = Theme.of(ctx).textTheme;
      return SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text('Switch context', style: t.titleLarge),
          ),
          Flexible(
            child: ListView(shrinkWrap: true, padding: const EdgeInsets.only(bottom: 12), children: [
              for (final ctxItem in contexts)
                ListTile(
                  leading: Icon(
                    switch (ctxItem.kind) {
                      ContextKind.club => PhosphorIconsRegular.buildings,
                      ContextKind.org => PhosphorIconsRegular.treeStructure,
                      ContextKind.global => PhosphorIconsRegular.shieldCheck,
                    },
                  ),
                  title: Text(ctxItem.label),
                  subtitle: Text(ctxItem.kind == ContextKind.club ? 'Club' : ctxItem.kindLabel),
                  trailing: ctxItem.key == s.context?.key
                      ? Icon(PhosphorIconsFill.checkCircle, color: c.success)
                      : null,
                  onTap: () async {
                    Navigator.pop(ctx);
                    await ref.read(authProvider.notifier).switchContext(ctxItem);
                    if (context.mounted) context.go('/');
                  },
                ),
            ]),
          ),
        ]),
      );
    },
  );
}
