import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/session.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';

typedef OrgKey = ({OrgLevel level, String? parentId});

final orgListProvider = FutureProvider.family<List<OrgNode>, OrgKey>((ref, k) async {
  ref.watch(contextKeyProvider);
  final list = await ref.watch(apiProvider).orgList(k.level, parentId: k.parentId);
  return list..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
});

/// Where the tree starts for the active context: everything for the super
/// admin, a director's own unit's children otherwise.
OrgKey? orgRootFor(AppContext? ctx) {
  if (ctx == null) return null;
  if (ctx.kind == ContextKind.global) return (level: OrgLevel.district, parentId: null);
  if (ctx.kind != ContextKind.org) return null;
  final unitId = ctx.key.split(':').last;
  return switch (ctx.unitType) {
    'district' => (level: OrgLevel.division, parentId: unitId),
    'division' => (level: OrgLevel.area, parentId: unitId),
    'area' => (level: OrgLevel.club, parentId: unitId),
    _ => null,
  };
}

String _plural(OrgLevel l) => switch (l) {
      OrgLevel.district => 'Districts',
      OrgLevel.division => 'Divisions',
      OrgLevel.area => 'Areas',
      OrgLevel.club => 'Clubs',
    };

/// One level of the District → Division → Area → Club tree.
class OrgTreeScreen extends ConsumerWidget {
  const OrgTreeScreen({super.key, this.level, this.parentId, this.title});
  final OrgLevel? level;
  final String? parentId;
  final String? title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(signedInProvider);
    final root = orgRootFor(s?.context);
    final key = level == null ? root : (level: level!, parentId: parentId);
    final isSuper = s?.session.user.isSuperAdmin == true && s?.context?.kind == ContextKind.global;
    if (key == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Org tree')),
        body: const EmptyState(icon: PhosphorIconsRegular.treeStructure, title: 'Switch to a director or full-access context'),
      );
    }
    final c = AppColors.of(context);
    final items = ref.watch(orgListProvider(key));
    final isRoot = level == null;

    return Scaffold(
      appBar: AppBar(title: Text(title ?? (isRoot ? (s?.context?.label ?? 'Org tree') : _plural(key.level)))),
      floatingActionButton: isSuper
          ? FloatingActionButton.extended(
              onPressed: () => showFormSheet<void>(context, builder: (_) => OrgNodeForm(level: key.level, parentId: key.parentId)),
              icon: const Icon(PhosphorIconsBold.plus),
              label: Text('Add ${key.level.label.toLowerCase()}'),
              shape: const StadiumBorder(),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(orgListProvider(key).future),
        child: AsyncBody<List<OrgNode>>(
          value: items,
          errorTitle: 'Could not load this list',
          onRetry: () => ref.invalidate(orgListProvider(key)),
          builder: (list) {
            if (list.isEmpty) {
              return ListView(children: [
                const SizedBox(height: 40),
                EmptyState(
                  icon: PhosphorIconsRegular.treeStructure,
                  title: 'No ${_plural(key.level).toLowerCase()} yet',
                  message: isSuper ? 'Add the ${_plural(key.level).toLowerCase()} that belong here.' : null,
                ),
              ]);
            }
            return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 100), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Text('${list.length} ${_plural(key.level).toLowerCase()}', style: Theme.of(context).textTheme.bodySmall),
              ),
              GroupCard(children: [
                for (final n in list)
                  RowTile(
                    leading: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(10)),
                      child: Icon(
                        key.level == OrgLevel.club ? PhosphorIconsRegular.buildings : PhosphorIconsRegular.treeStructure,
                        size: 19,
                        color: c.inkSoft,
                      ),
                    ),
                    title: n.name,
                    subtitle: [
                      if (n.code != null) n.code!,
                      if (n.clubNumber != null) '#${n.clubNumber}',
                      if (n.status != null && n.status != 'active') n.status!,
                    ].join(' · '),
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      IconButton(
                        tooltip: 'Actions',
                        icon: Icon(PhosphorIconsBold.dotsThreeVertical, size: 18, color: c.inkMuted),
                        onPressed: () => _actions(context, ref, key, n, isSuper),
                      ),
                      if (key.level.child != null) const Chevron(),
                    ]),
                    onTap: key.level.child == null
                        ? () => _actions(context, ref, key, n, isSuper)
                        : () => context.push(
                              '/org/${key.level.child!.name}/${n.id}?title=${Uri.encodeQueryComponent('${n.name} — ${_plural(key.level.child!)}')}',
                            ),
                  ),
              ]),
            ]);
          },
        ),
      ),
    );
  }

  void _actions(BuildContext context, WidgetRef ref, OrgKey key, OrgNode n, bool isSuper) {
    final api = ref.read(apiProvider);
    showActionSheet(context, title: n.name, actions: [
      SheetAction(
        icon: PhosphorIconsRegular.pencilSimple,
        label: 'Edit',
        onTap: () => showFormSheet<void>(context, builder: (_) => OrgNodeForm(level: key.level, parentId: key.parentId, node: n)),
      ),
      if (isSuper && key.level.parent != null)
        SheetAction(
          icon: PhosphorIconsRegular.arrowsLeftRight,
          label: 'Move to a different ${key.level.parent!.label.toLowerCase()}',
          onTap: () async {
            final parents = await api.orgList(key.level.parent!);
            if (!context.mounted) return;
            final target = await showModalBottomSheet<OrgNode>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              builder: (ctx) => DraggableScrollableSheet(
                expand: false,
                initialChildSize: 0.6,
                builder: (ctx, scroll) => ListView(controller: scroll, children: [
                  for (final p in parents.where((p) => p.id != key.parentId))
                    ListTile(title: Text(p.name), onTap: () => Navigator.pop(ctx, p)),
                  if (parents.length <= 1)
                    const Padding(padding: EdgeInsets.all(20), child: Text('There is nowhere else to move this to yet.')),
                ]),
              ),
            );
            if (target == null) return;
            try {
              await api.orgUpdate(key.level, n.id, {key.level.parentField!: target.id});
              HapticFeedback.lightImpact();
              ref.invalidate(orgListProvider);
              if (context.mounted) showToast(context, 'Moved to ${target.name}');
            } catch (e) {
              if (context.mounted) showToast(context, errorText(e), error: true);
            }
          },
        ),
      if (isSuper)
        SheetAction(
          icon: PhosphorIconsRegular.trash,
          label: 'Delete ${key.level.label.toLowerCase()}',
          destructive: true,
          onTap: () async {
            final ok = await confirmDialog(
              context,
              title: 'Delete ${n.name}?',
              message: key.level == OrgLevel.club
                  ? 'This cannot be undone.'
                  : 'Everything under it is deleted too. This cannot be undone.',
              confirmLabel: 'Delete',
              destructive: true,
            );
            if (!ok) return;
            try {
              await api.orgDelete(key.level, n.id);
              ref.invalidate(orgListProvider);
              if (context.mounted) showToast(context, '${key.level.label} deleted');
            } catch (e) {
              if (context.mounted) showToast(context, errorText(e), error: true);
            }
          },
        ),
    ]);
  }
}

class OrgNodeForm extends ConsumerStatefulWidget {
  const OrgNodeForm({super.key, required this.level, this.parentId, this.node});
  final OrgLevel level;
  final String? parentId;
  final OrgNode? node;
  @override
  ConsumerState<OrgNodeForm> createState() => _OrgNodeFormState();
}

class _OrgNodeFormState extends ConsumerState<OrgNodeForm> {
  late final _name = TextEditingController(text: widget.node?.name ?? '');
  late final _code = TextEditingController(text: widget.node?.code ?? widget.node?.clubNumber ?? '');
  late String _status = widget.node?.status ?? 'active';
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) return;
    if (widget.level == OrgLevel.district && _code.text.trim().isEmpty) {
      showToast(context, 'A district needs a code', error: true);
      return;
    }
    setState(() => _busy = true);
    final api = ref.read(apiProvider);
    final body = <String, dynamic>{
      'name': _name.text.trim(),
      if (widget.level == OrgLevel.district) 'code': _code.text.trim(),
      if (widget.level == OrgLevel.club) 'clubNumber': _code.text.trim().isEmpty ? null : _code.text.trim(),
      if (widget.level == OrgLevel.club) 'status': _status,
    };
    try {
      if (widget.node == null) {
        if (widget.level.parentField != null) body[widget.level.parentField!] = widget.parentId;
        await api.orgCreate(widget.level, body);
      } else {
        await api.orgUpdate(widget.level, widget.node!.id, body);
      }
      ref.invalidate(orgListProvider);
      if (!mounted) return;
      showToast(context, '${widget.level.label} ${widget.node == null ? 'added' : 'updated'}');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.level;
    return SheetScaffold(
      title: '${widget.node == null ? 'Add' : 'Edit'} ${l.label.toLowerCase()}',
      primaryLabel: 'Save',
      busy: _busy,
      onPrimary: _save,
      children: [
        const FieldLabel('Name'),
        TextField(
          controller: _name,
          autofocus: widget.node == null,
          decoration: InputDecoration(
            hintText: switch (l) {
              OrgLevel.district => 'District 88',
              OrgLevel.division => 'Division A',
              OrgLevel.area => 'Area A1',
              OrgLevel.club => 'Sunrise Toastmasters',
            },
          ),
        ),
        if (l == OrgLevel.district) ...[
          const FieldLabel('Code'),
          TextField(controller: _code, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'D88')),
        ],
        if (l == OrgLevel.club) ...[
          const FieldLabel('Club number', optional: true),
          TextField(controller: _code, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: '1002345')),
          const FieldLabel('Status'),
          Wrap(spacing: 8, children: [
            for (final st in const ['active', 'low', 'suspended'])
              ChoiceChip(label: Text(st[0].toUpperCase() + st.substring(1)), selected: _status == st, onSelected: (_) => setState(() => _status = st)),
          ]),
        ],
      ],
    );
  }
}
