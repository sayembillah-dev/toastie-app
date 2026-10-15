import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/pathways.dart';
import '../../ui/widgets.dart';

enum _Tab { members, pathways }

/// Education (PRD §10): member roster with levels + the Pathways catalog.
class LearnScreen extends ConsumerStatefulWidget {
  const LearnScreen({super.key});
  @override
  ConsumerState<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends ConsumerState<LearnScreen> {
  _Tab _tab = _Tab.members;
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(canProvider)(Act.read, 'education')) return const AccessRestricted(title: 'Learn');
    final q = _q.text.trim().toLowerCase();
    return Scaffold(
      appBar: AppBar(title: const Text('Learn')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: SizedBox(
            width: double.infinity,
            child: SegmentedButton<_Tab>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: _Tab.members, label: Text('Members')),
                ButtonSegment(value: _Tab.pathways, label: Text('Pathways')),
              ],
              selected: {_tab},
              onSelectionChanged: (s) {
                HapticFeedback.selectionClick();
                setState(() {
                  _tab = s.first;
                  _q.clear();
                });
              },
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: TextField(
            controller: _q,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: _tab == _Tab.members ? 'Search name, role or pathway' : 'Search pathways or projects',
              prefixIcon: const Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
            ),
          ),
        ),
        Expanded(child: _tab == _Tab.members ? _members(q) : _pathways(q)),
      ]),
    );
  }

  Widget _members(String q) {
    final c = AppColors.of(context);
    final members = ref.watch(membersProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(membersProvider.future),
      child: AsyncBody<List<Member>>(
        value: members,
        errorTitle: 'Could not load the roster',
        onRetry: () => ref.invalidate(membersProvider),
        builder: (all) {
          final list = all
              .where((m) =>
                  m.isActive &&
                  (q.isEmpty ||
                      m.name.toLowerCase().contains(q) ||
                      m.rolesLabel.toLowerCase().contains(q) ||
                      (m.pathway ?? '').toLowerCase().contains(q)))
              .toList();
          if (list.isEmpty) {
            return ListView(children: const [
              EmptyState(icon: PhosphorIconsRegular.users, title: 'No members match', message: 'Try a different name, role, or pathway.'),
            ]);
          }
          return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 32), children: [
            GroupCard(children: [
              for (final m in list)
                RowTile(
                  leading: Avatar(name: m.name, url: m.avatarUrl, size: 40),
                  title: m.name,
                  subtitle: '${m.rolesLabel} · ${m.pathway ?? 'Not started'}',
                  trailing: Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: m.level == null ? c.fill : c.ink,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      m.level == null ? '—' : 'L${m.level}',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: m.level == null ? c.inkMuted : c.canvas),
                    ),
                  ),
                  onTap: () => context.push('/learn/members/${m.id}'),
                ),
            ]),
          ]);
        },
      ),
    );
  }

  Widget _pathways(String q) {
    final catalog = ref.watch(pathwayCatalogProvider);
    return AsyncBody<PathwayCatalog>(
      value: catalog,
      builder: (cat) {
        final list = cat.pathways
            .where((p) =>
                q.isEmpty ||
                p.name.toLowerCase().contains(q) ||
                p.allProjects.any((pr) => pr.name.toLowerCase().contains(q)))
            .toList();
        if (list.isEmpty) {
          return const EmptyState(icon: PhosphorIconsRegular.path, title: 'No pathways match', message: 'Try a different pathway, project, or elective name.');
        }
        return ListView(padding: const EdgeInsets.only(bottom: 32), children: [
          for (final p in list)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                onTap: () => context.push('/learn/pathways/${p.id}'),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.name, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(p.description, maxLines: 3, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 10),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    Pill('${p.levels.length} levels'),
                    Pill('${p.requiredCount} required projects'),
                    Pill('${p.electiveCount} electives'),
                  ]),
                ]),
              ),
            ),
        ]);
      },
    );
  }
}
