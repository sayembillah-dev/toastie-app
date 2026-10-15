import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/tokens.dart';
import '../../domain/pathways.dart';
import '../../ui/widgets.dart';

class PathwayDetailScreen extends ConsumerWidget {
  const PathwayDetailScreen({super.key, required this.pathwayId});
  final String pathwayId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final catalog = ref.watch(pathwayCatalogProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Pathway')),
      body: AsyncBody<PathwayCatalog>(
        value: catalog,
        builder: (cat) {
          final p = cat.pathways.where((x) => x.id == pathwayId).firstOrNull;
          if (p == null) return const Center(child: Text('Pathway not found'));
          return ListView(padding: const EdgeInsets.only(bottom: 40), children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.name, style: t.headlineMedium),
                const SizedBox(height: 6),
                Text(p.description, style: t.bodyMedium?.copyWith(color: c.inkSoft)),
              ]),
            ),
            for (final l in p.levels)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  padding: EdgeInsets.zero,
                  child: Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      initiallyExpanded: l.level == 1,
                      title: Text('Level ${l.level} · ${l.title}', style: t.titleMedium),
                      subtitle: Text('${l.required.length} required${l.electives.isEmpty ? '' : ' · ${l.electives.length} electives'}',
                          style: t.bodySmall),
                      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      children: [
                        for (final pr in l.required) _project(context, pr),
                        if (l.electives.isNotEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.only(top: 10, bottom: 4),
                            child: Align(alignment: Alignment.centerLeft, child: Text('ELECTIVES', style: t.labelSmall)),
                          ),
                          for (final pr in l.electives) _project(context, pr),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
          ]);
        },
      ),
    );
  }

  Widget _project(BuildContext context, PathwayProject p) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Expanded(child: Text(p.name, style: const TextStyle(fontSize: 15))),
        if (p.speechTime != null) Text(p.speechTime!, style: TextStyle(fontSize: 13, color: c.inkMuted)),
      ]),
    );
  }
}
