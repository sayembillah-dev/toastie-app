import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/config.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import '../meetings/meeting_common.dart';
import 'club_admin_screen.dart' show invitesProvider;

String inviteUrl(String token) => '${AppConfig.webOrigin}/invite/$token';

/// Roster management (PRD §12.2).
class MembersAdminScreen extends ConsumerStatefulWidget {
  const MembersAdminScreen({super.key});
  @override
  ConsumerState<MembersAdminScreen> createState() => _MembersAdminScreenState();
}

class _MembersAdminScreenState extends ConsumerState<MembersAdminScreen> {
  bool _removed = false;
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() f, String done) async {
    try {
      await f();
      HapticFeedback.lightImpact();
      ref.invalidate(membersProvider);
      ref.invalidate(invitesProvider);
      if (mounted) showToast(context, done);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  void _memberActions(Member m) {
    final api = ref.read(apiProvider);
    showActionSheet(context, title: m.name, actions: [
      if (m.isActive) ...[
        SheetAction(
          icon: PhosphorIconsRegular.pencilSimple,
          label: 'Edit member',
          onTap: () => showFormSheet<void>(context, builder: (_) => MemberForm(member: m)),
        ),
        SheetAction(
          icon: PhosphorIconsRegular.shieldStar,
          label: m.isClubAdmin ? 'Remove Club Admin' : 'Make Club Admin',
          subtitle: m.isClubAdmin ? null : 'Full access to this club',
          onTap: () => _run(() => api.setMemberAdmin(m.id, !m.isClubAdmin),
              m.isClubAdmin ? '${m.name} is no longer a Club Admin' : '${m.name} is now a Club Admin'),
        ),
        if (m.userId == null)
          SheetAction(
            icon: PhosphorIconsRegular.linkSimple,
            label: 'Invite',
            subtitle: 'A personal join link for ${m.firstName}',
            onTap: () async {
              try {
                final inv = await api.createInvite(
                  inviteeName: m.name,
                  roles: m.roles.map((r) => clubToOfficer[r]).whereType<String>().toList(),
                  membershipId: m.id,
                );
                ref.invalidate(invitesProvider);
                if (mounted) await shareText(context, inviteUrl(inv.token));
              } catch (e) {
                if (mounted) showToast(context, errorText(e), error: true);
              }
            },
          ),
        SheetAction(
          icon: PhosphorIconsRegular.userMinus,
          label: 'Remove member',
          destructive: true,
          onTap: () async {
            final ok = await confirmDialog(context,
                title: 'Remove ${m.name}?',
                message: 'They lose access to this club. You can restore them later.',
                confirmLabel: 'Remove',
                destructive: true);
            if (ok) await _run(() => api.setMemberStatus(m.id, 'removed'), '${m.name} was removed');
          },
        ),
      ] else
        SheetAction(
          icon: PhosphorIconsRegular.arrowCounterClockwise,
          label: 'Restore member',
          onTap: () => _run(() => api.setMemberStatus(m.id, 'active'), '${m.name} is back on the roster'),
        ),
    ]);
  }

  void _addMenu() => showActionSheet(context, title: 'Add member', actions: [
        SheetAction(
          icon: PhosphorIconsRegular.userPlus,
          label: 'Single member',
          onTap: () => showFormSheet<void>(context, builder: (_) => const MemberForm()),
        ),
        SheetAction(
          icon: PhosphorIconsRegular.usersThree,
          label: 'Bulk members',
          subtitle: 'Several rows at once, or paste a list',
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => const BulkAddScreen())),
        ),
        SheetAction(
          icon: PhosphorIconsRegular.userSwitch,
          label: 'Add from guests',
          onTap: () => showFormSheet<void>(context, builder: (_) => const _ConvertGuestForm()),
        ),
        SheetAction(
          icon: PhosphorIconsRegular.linkSimple,
          label: 'Invite link',
          subtitle: 'Anyone who opens it joins with the roles you pick',
          onTap: () => showFormSheet<void>(context, builder: (_) => const _InviteForm()),
        ),
      ]);

  @override
  Widget build(BuildContext context) {
    final can = ref.watch(canProvider);
    if (!can(Act.read, 'memberRole')) return const AccessRestricted(title: 'Members');
    final canEdit = can(Act.update, 'member');
    final c = AppColors.of(context);
    final members = ref.watch(membersProvider);
    final invites = (ref.watch(invitesProvider).value ?? const <Invite>[]).where((i) => i.isPending).toList();
    final q = _q.text.trim().toLowerCase();

    return Scaffold(
      appBar: AppBar(title: const Text('Members')),
      floatingActionButton: can(Act.create, 'member')
          ? FloatingActionButton(tooltip: 'Add member', onPressed: _addMenu, child: const Icon(PhosphorIconsBold.plus))
          : null,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(invitesProvider);
          ref.invalidate(membersProvider);
          await ref.read(membersProvider.future);
        },
        child: AsyncBody<List<Member>>(
          value: members,
          errorTitle: 'Could not load the roster',
          onRetry: () => ref.invalidate(membersProvider),
          builder: (all) {
            final list = all
                .where((m) => m.isActive != _removed && (q.isEmpty || m.name.toLowerCase().contains(q)))
                .toList();
            return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 100), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: SizedBox(
                  width: double.infinity,
                  child: SegmentedButton<bool>(
                    showSelectedIcon: false,
                    segments: [
                      ButtonSegment(value: false, label: Text('Active (${all.where((m) => m.isActive).length})')),
                      ButtonSegment(value: true, label: Text('Removed (${all.where((m) => !m.isActive).length})')),
                    ],
                    selected: {_removed},
                    onSelectionChanged: (s) => setState(() => _removed = s.first),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  controller: _q,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(hintText: 'Search members', prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20)),
                ),
              ),
              if (list.isEmpty)
                const EmptyState(icon: PhosphorIconsRegular.users, title: 'No one here')
              else
                GroupCard(children: [
                  for (final m in list)
                    RowTile(
                      leading: Avatar(name: m.name, url: m.avatarUrl, size: 40),
                      title: m.name,
                      subtitle: [m.rolesLabel, if (m.userId == null) 'Not joined yet'].join(' · '),
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        if (m.isClubAdmin) const Pill('Admin'),
                        if (canEdit) Icon(PhosphorIconsBold.dotsThreeVertical, size: 18, color: c.inkMuted),
                      ]),
                      onTap: canEdit ? () => _memberActions(m) : null,
                    ),
                ]),
              if (!_removed && invites.isNotEmpty) ...[
                const SectionLabel('Pending invites'),
                GroupCard(children: [
                  for (final i in invites)
                    RowTile(
                      leading: const Icon(PhosphorIconsRegular.envelopeSimple),
                      title: i.inviteeName ?? 'Invite',
                      subtitle: [
                        i.roles.map((r) => officerRoles[r] ?? r).join(', '),
                        if (i.expiresAt != null) 'expires ${BdTime.date(DateTime.parse(i.expiresAt!))}',
                      ].join(' · '),
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(
                          tooltip: 'Share link',
                          icon: const Icon(PhosphorIconsRegular.shareNetwork, size: 20),
                          onPressed: () => shareText(context, inviteUrl(i.token)),
                        ),
                        IconButton(
                          tooltip: 'Revoke',
                          icon: Icon(PhosphorIconsRegular.x, size: 20, color: c.danger),
                          onPressed: () async {
                            final ok = await confirmDialog(context, title: 'Revoke this invite?', confirmLabel: 'Revoke', destructive: true);
                            if (ok) await _run(() => ref.read(apiProvider).revokeInvite(i.id), 'Invite revoked');
                          },
                        ),
                      ]),
                    ),
                ]),
              ],
            ]);
          },
        ),
      ),
    );
  }
}

/// Multi-select of officer roles as chips.
class RolePicker extends StatelessWidget {
  const RolePicker({super.key, required this.value, required this.onChanged});
  final Set<String> value;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final e in officerRoles.entries)
        FilterChip(
          label: Text(e.value),
          selected: value.contains(e.key),
          onSelected: (sel) {
            final next = {...value};
            sel ? next.add(e.key) : next.remove(e.key);
            if (next.isEmpty) next.add('Member');
            onChanged(next);
          },
        ),
    ]);
  }
}

/// Add or edit one roster row.
class MemberForm extends ConsumerStatefulWidget {
  const MemberForm({super.key, this.member});
  final Member? member;
  @override
  ConsumerState<MemberForm> createState() => _MemberFormState();
}

class _MemberFormState extends ConsumerState<MemberForm> {
  late final _name = TextEditingController(text: widget.member?.name ?? '');
  late final _phone = TextEditingController(text: widget.member?.phone ?? '');
  late Set<String> _roles = widget.member == null
      ? {'Member'}
      : widget.member!.roles.map((r) => clubToOfficer[r]).whereType<String>().toSet();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Enter a name', error: true);
      return;
    }
    if (validatePhone(_phone.text, required: false) != null) {
      showToast(context, 'Phone must be 11 digits', error: true);
      return;
    }
    setState(() => _busy = true);
    final api = ref.read(apiProvider);
    try {
      if (widget.member == null) {
        await api.createMember(name: _name.text.trim(), phone: _phone.text.trim(), roles: _roles.toList());
      } else {
        await api.updateMember(widget.member!.id, {
          'name': _name.text.trim(),
          if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
          'roles': _roles.toList(),
        });
      }
      ref.invalidate(membersProvider);
      if (!mounted) return;
      showToast(context, widget.member == null ? 'Member added' : 'Member updated');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SheetScaffold(
      title: widget.member == null ? 'Add member' : 'Edit member',
      primaryLabel: 'Save',
      busy: _busy,
      onPrimary: _save,
      children: [
        const FieldLabel('Full name'),
        TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(hintText: 'e.g. Aisha Patel')),
        const FieldLabel('Phone', optional: true),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
          decoration: const InputDecoration(
            hintText: '01XXXXXXXXX',
            helperText: 'When they sign up with this number, this roster row links to their account automatically.',
          ),
        ),
        const FieldLabel('Roles'),
        RolePicker(value: _roles, onChanged: (v) => setState(() => _roles = v)),
      ],
    );
  }
}

class _InviteForm extends ConsumerStatefulWidget {
  const _InviteForm();
  @override
  ConsumerState<_InviteForm> createState() => _InviteFormState();
}

class _InviteFormState extends ConsumerState<_InviteForm> {
  final _name = TextEditingController();
  Set<String> _roles = {'Member'};
  bool _busy = false;
  Invite? _created;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Who is this link for?', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final inv = await ref.read(apiProvider).createInvite(inviteeName: _name.text.trim(), roles: _roles.toList());
      ref.invalidate(invitesProvider);
      setState(() => _created = inv);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_created != null) {
      final url = inviteUrl(_created!.token);
      return SheetScaffold(
        title: 'Join link',
        subtitle: 'Works once. You can revoke it from Pending invites.',
        primaryLabel: 'Share link',
        onPrimary: () => shareText(context, url),
        children: [
          SelectableText(url),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => copyText(context, url, 'Link copied'),
            icon: const Icon(PhosphorIconsRegular.copy, size: 18),
            label: const Text('Copy link'),
          ),
        ],
      );
    }
    return SheetScaffold(
      title: 'Invite a member',
      primaryLabel: 'Generate link',
      busy: _busy,
      onPrimary: _create,
      children: [
        const FieldLabel('Name'),
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(
            hintText: 'e.g. Jordan Lee',
            helperText: 'Just for your own tracking — it doesn’t limit who can open the link.',
          ),
        ),
        const FieldLabel('Role(s)'),
        RolePicker(value: _roles, onChanged: (v) => setState(() => _roles = v)),
      ],
    );
  }
}

class _ConvertGuestForm extends ConsumerStatefulWidget {
  const _ConvertGuestForm();
  @override
  ConsumerState<_ConvertGuestForm> createState() => _ConvertGuestFormState();
}

class _ConvertGuestFormState extends ConsumerState<_ConvertGuestForm> {
  Guest? _guest;
  Set<String> _roles = {'Member'};
  bool _busy = false;

  Future<void> _convert() async {
    if (_guest == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).convertGuest(_guest!.id, _roles.toList());
      ref.invalidate(membersProvider);
      ref.invalidate(guestsProvider);
      if (!mounted) return;
      showToast(context, '${_guest!.name} joined as a member — they can log in now');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final guests = (ref.watch(guestsProvider).value ?? const <Guest>[]).where((g) => g.stage != 'joined-club').toList();
    return SheetScaffold(
      title: 'Add from guests',
      subtitle: 'The guest needs an email on file.',
      primaryLabel: 'Add as member',
      busy: _busy,
      onPrimary: _guest == null ? null : _convert,
      children: [
        const FieldLabel('Guest'),
        DropdownButtonFormField<Guest>(
          initialValue: _guest,
          isExpanded: true,
          hint: const Text('Pick a guest'),
          items: [
            for (final g in guests)
              DropdownMenuItem(value: g, enabled: g.email != null, child: Text('${g.name}${g.email == null ? ' — no email' : ''}')),
          ],
          onChanged: (g) => setState(() => _guest = g),
        ),
        const FieldLabel('Roles', optional: true),
        RolePicker(value: _roles, onChanged: (v) => setState(() => _roles = v)),
      ],
    );
  }
}

/// Bulk add: editable rows, or paste "Name, 01XXXXXXXXX" lines.
class BulkAddScreen extends ConsumerStatefulWidget {
  const BulkAddScreen({super.key});
  @override
  ConsumerState<BulkAddScreen> createState() => _BulkAddScreenState();
}

class _BulkRow {
  _BulkRow([String name = '', String phone = ''])
      : name = TextEditingController(text: name),
        phone = TextEditingController(text: phone);
  final TextEditingController name;
  final TextEditingController phone;
  String? error;
}

class _BulkAddScreenState extends ConsumerState<BulkAddScreen> {
  final List<_BulkRow> _rows = [_BulkRow(), _BulkRow(), _BulkRow()];
  bool _busy = false;

  @override
  void dispose() {
    for (final r in _rows) {
      r.name.dispose();
      r.phone.dispose();
    }
    super.dispose();
  }

  Future<void> _paste() async {
    final d = await Clipboard.getData('text/plain');
    final lines = (d?.text ?? '').split(RegExp(r'[\r\n]+')).map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
    if (lines.isEmpty) {
      if (mounted) showToast(context, 'Nothing to paste — copy “Name, phone” lines first');
      return;
    }
    final parsed = <_BulkRow>[];
    for (final l in lines) {
      final phone = RegExp(r'01\d{9}').firstMatch(l.replaceAll(RegExp(r'[\s-]'), ''))?.group(0) ?? '';
      final name = l.split(RegExp(r'[,\t]')).first.replaceAll(RegExp(r'01[\d\s-]{9,}'), '').trim();
      if (name.isNotEmpty) parsed.add(_BulkRow(name, phone));
    }
    setState(() {
      _rows.removeWhere((r) => r.name.text.trim().isEmpty);
      _rows.addAll(parsed);
    });
    if (mounted) showToast(context, 'Pasted ${parsed.length} ${parsed.length == 1 ? 'row' : 'rows'}');
  }

  Future<void> _submit() async {
    final rows = _rows.where((r) => r.name.text.trim().isNotEmpty).toList();
    if (rows.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await ref.read(apiProvider).bulkCreateMembers([
        for (final r in rows)
          {'name': r.name.text.trim(), if (r.phone.text.trim().isNotEmpty) 'phone': r.phone.text.trim(), 'roles': ['Member']},
      ]);
      ref.invalidate(membersProvider);
      final created = (res['created'] as List? ?? const []).length;
      final failed = (res['failed'] as List? ?? const []).whereType<Map>().toList();
      if (failed.isEmpty) {
        if (!mounted) return;
        showToast(context, 'Added $created ${created == 1 ? 'member' : 'members'}');
        Navigator.pop(context);
        return;
      }
      setState(() {
        final failedIdx = {for (final f in failed) (f['index'] as num).toInt(): '${f['message']}'};
        final keep = <_BulkRow>[];
        for (var i = 0; i < rows.length; i++) {
          if (failedIdx.containsKey(i)) {
            rows[i].error = failedIdx[i];
            keep.add(rows[i]);
          }
        }
        _rows
          ..clear()
          ..addAll(keep);
      });
      if (mounted) showToast(context, 'Added $created, skipped ${failed.length} — see the highlighted rows', error: true);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add members in bulk'),
        actions: [
          TextButton(
            onPressed: _busy ? null : _submit,
            child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Add'),
          ),
        ],
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
        Text('Everyone joins as a Member — set officer roles afterwards from Edit member.', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _paste,
          icon: const Icon(PhosphorIconsRegular.clipboardText, size: 18),
          label: const Text('Paste “Name, phone” lines'),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < _rows.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _rows[i].name,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(hintText: 'Row ${i + 1} · Full name'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: _rows[i].phone,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                    decoration: const InputDecoration(hintText: 'Phone'),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove row',
                  icon: Icon(PhosphorIconsRegular.x, color: c.inkMuted),
                  onPressed: () => setState(() => _rows.removeAt(i)),
                ),
              ]),
              if (_rows[i].error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4, left: 4),
                  child: Text(_rows[i].error!, style: TextStyle(color: c.danger, fontSize: 12.5)),
                ),
            ]),
          ),
        TextButton.icon(
          onPressed: () => setState(() => _rows.add(_BulkRow())),
          icon: const Icon(PhosphorIconsRegular.plus, size: 16),
          label: const Text('Add row'),
        ),
      ]),
    );
  }
}
