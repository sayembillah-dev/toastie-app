import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/session.dart';
import '../../core/bd_time.dart';
import '../../core/config.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/models_admin.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/widgets.dart';
import '../admin/members_admin_screen.dart' show RolePicker;
import '../meetings/meeting_common.dart';
import 'org_tree_screen.dart';

String generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  final r = Random.secure();
  return List.generate(10, (_) => chars[r.nextInt(chars.length)]).join();
}

final _allClubsProvider = FutureProvider<List<OrgNode>>((ref) async {
  ref.watch(contextKeyProvider);
  final list = await ref.watch(apiProvider).orgList(OrgLevel.club);
  return list..sort((a, b) => a.name.compareTo(b.name));
});

/// Super Admin → Users (PRD §13).
class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});
  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> {
  final _q = TextEditingController();
  final List<PlatformUser> _items = [];
  int _page = 0;
  int _total = 0;
  bool _hasMore = true;
  bool _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _items.clear();
        _page = 0;
        _hasMore = true;
      }
    });
    try {
      final page = await ref.read(apiProvider).users(search: _q.text.trim(), page: _page + 1);
      setState(() {
        _items.addAll(page.items);
        _page++;
        _total = page.total;
        _hasMore = page.hasMore;
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final me = ref.watch(signedInProvider)?.session.user.id;
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => const CreateUserScreen()));
          _load(reset: true);
        },
        icon: const Icon(PhosphorIconsBold.userPlus),
        label: const Text('Add user'),
        shape: const StadiumBorder(),
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: NotificationListener<ScrollNotification>(
          onNotification: (n) {
            if (n.metrics.pixels > n.metrics.maxScrollExtent - 300 && _hasMore && !_loading) _load();
            return false;
          },
          child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 100), children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: TextField(
                controller: _q,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _load(reset: true),
                decoration: InputDecoration(
                  hintText: 'Search phone, email, or name',
                  prefixIcon: const Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
                  suffixIcon: IconButton(icon: const Icon(PhosphorIconsRegular.arrowRight), onPressed: () => _load(reset: true)),
                ),
              ),
            ),
            if (_items.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text('$_total accounts', style: Theme.of(context).textTheme.bodySmall),
              ),
            if (_error != null && _items.isEmpty)
              ErrorState(error: _error!, title: 'Could not load users', onRetry: () => _load(reset: true))
            else if (_items.isEmpty && !_loading)
              const EmptyState(icon: PhosphorIconsRegular.users, title: 'No matches')
            else
              GroupCard(children: [
                for (final u in _items)
                  RowTile(
                    leading: Avatar(name: u.name, size: 40),
                    title: u.name.isEmpty ? u.phone : u.name,
                    subtitle: [
                      u.phone,
                      if (u.email != null) u.email!,
                      '${u.membershipCount} membership${u.membershipCount == 1 ? '' : 's'}',
                      if (u.createdAt != null) 'joined ${BdTime.date(DateTime.parse(u.createdAt!))}',
                    ].join(' · '),
                    trailing: Wrap(spacing: 4, children: [
                      if (u.id == me) const Pill('You'),
                      if (u.isSuperAdmin) const Pill('Super Admin'),
                      if (u.status == 'suspended') Pill('Suspended', color: c.danger, background: c.dangerSoft),
                    ]),
                    onTap: () async {
                      await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => UserDetailScreen(user: u)));
                      _load(reset: true);
                    },
                  ),
              ]),
            if (_loading)
              const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
          ]),
        ),
      ),
    );
  }
}

class UserDetailScreen extends ConsumerStatefulWidget {
  const UserDetailScreen({super.key, required this.user});
  final PlatformUser user;
  @override
  ConsumerState<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends ConsumerState<UserDetailScreen> {
  late PlatformUser _u = widget.user;
  List<Member>? _memberships;
  List<OrgRoleAssignment>? _assignments;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    final api = ref.read(apiProvider);
    try {
      final r = await Future.wait([api.userMemberships(_u.id), api.userOrgAssignments(_u.id)]);
      if (!mounted) return;
      setState(() {
        _memberships = r[0] as List<Member>;
        _assignments = r[1] as List<OrgRoleAssignment>;
      });
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  Future<void> _run(Future<void> Function() f, String done, {PlatformUser? next}) async {
    try {
      await f();
      HapticFeedback.lightImpact();
      if (next != null) setState(() => _u = next);
      await _reload();
      if (mounted) showToast(context, done);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  PlatformUser _with({String? status, bool? isSuperAdmin}) => PlatformUser(
        id: _u.id,
        phone: _u.phone,
        firstName: _u.firstName,
        lastName: _u.lastName,
        status: status ?? _u.status,
        isSuperAdmin: isSuperAdmin ?? _u.isSuperAdmin,
        membershipCount: _u.membershipCount,
        orgAssignmentCount: _u.orgAssignmentCount,
        email: _u.email,
        tiMemberNumber: _u.tiMemberNumber,
        createdAt: _u.createdAt,
      );

  Future<void> _resetPassword() async {
    final ok = await confirmDialog(context,
        title: 'Reset password?',
        message: 'A new password is generated. Every active session for this account is signed out.',
        confirmLabel: 'Set new password');
    if (!ok) return;
    final pw = generatePassword();
    try {
      await ref.read(apiProvider).setUserPassword(_u.id, pw);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('New password'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Shown once — copy it before closing.'),
            const SizedBox(height: 12),
            SelectableText(pw, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: 2)),
          ]),
          actions: [
            TextButton(onPressed: () => copyText(ctx, 'Phone: ${_u.phone}\nPassword: $pw', 'Copied'), child: const Text('Copy')),
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done')),
          ],
        ),
      );
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final api = ref.read(apiProvider);
    final clubs = ref.watch(_allClubsProvider).value ?? const <OrgNode>[];
    final clubName = {for (final x in clubs) x.id: x.name};
    final isMe = ref.watch(signedInProvider)?.session.user.id == _u.id;

    return Scaffold(
      appBar: AppBar(
        title: Text(_u.name.isEmpty ? _u.phone : _u.name),
        actions: [
          IconButton(
            tooltip: 'Edit profile',
            icon: const Icon(PhosphorIconsRegular.pencilSimple),
            onPressed: () async {
              await showFormSheet<void>(context, builder: (_) => _UserProfileForm(user: _u));
              if (!context.mounted) return;
              Navigator.pop(context);
            },
          ),
        ],
      ),
      body: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Row(children: [
            Avatar(name: _u.name, size: 56),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_u.phone, style: t.titleMedium),
                if (_u.email != null) Text(_u.email!, style: t.bodySmall),
                if (_u.tiMemberNumber != null) Text('TI #${_u.tiMemberNumber}', style: t.bodySmall),
              ]),
            ),
          ]),
        ),
        const SectionLabel('Account'),
        GroupCard(children: [
          SwitchListTile.adaptive(
            title: const Text('Active'),
            subtitle: Text(_u.status == 'suspended' ? 'Suspended — cannot sign in' : 'Can sign in'),
            value: _u.status != 'suspended',
            onChanged: isMe
                ? null
                : (v) => _run(() => api.setUserStatus(_u.id, v ? 'active' : 'suspended'), v ? 'Reactivated' : 'Suspended',
                    next: _with(status: v ? 'active' : 'suspended')),
          ),
          SwitchListTile.adaptive(
            title: const Text('Super Admin'),
            subtitle: const Text('Full platform access'),
            value: _u.isSuperAdmin,
            onChanged: isMe
                ? null
                : (v) => _run(() => api.setUserAdmin(_u.id, v), v ? 'Promoted to Super Admin' : 'Super Admin removed',
                    next: _with(isSuperAdmin: v)),
          ),
          RowTile(
            leading: const Icon(PhosphorIconsRegular.key),
            title: 'Reset password',
            subtitle: 'Generate a new one and sign out every session',
            onTap: _resetPassword,
          ),
        ]),
        SectionLabel(
          'Club memberships',
          trailing: GestureDetector(
            onTap: () => showFormSheet<void>(context, builder: (_) => _AddMembershipForm(userId: _u.id, clubs: clubs))
                .then((_) => _reload()),
            child: Text('Add to club', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.ink)),
          ),
        ),
        if (_memberships == null)
          const SkeletonBox(height: 60)
        else if (_memberships!.isEmpty)
          AppCard(child: Text('Not a member of any club yet.', style: t.bodySmall))
        else
          GroupCard(children: [
            for (final m in _memberships!)
              RowTile(
                title: clubName[m.clubId] ?? 'Club',
                subtitle: [m.rolesLabel, if (m.isClubAdmin) 'Club Admin', if (!m.isActive) 'Removed'].join(' · '),
                trailing: Icon(PhosphorIconsBold.dotsThreeVertical, size: 18, color: c.inkMuted),
                onTap: () => showActionSheet(context, actions: [
                  SheetAction(
                    icon: PhosphorIconsRegular.pencilSimple,
                    label: 'Edit roles',
                    onTap: () => showFormSheet<void>(context, builder: (_) => _EditMembershipForm(userId: _u.id, member: m))
                        .then((_) => _reload()),
                  ),
                  SheetAction(
                    icon: PhosphorIconsRegular.shieldCheck,
                    label: m.isClubAdmin ? 'Remove Club Admin' : 'Make Club Admin',
                    onTap: () => _run(() => api.updateUserMembership(_u.id, m.id, {'isClubAdmin': !m.isClubAdmin}), 'Membership updated'),
                  ),
                  SheetAction(
                    icon: m.isActive ? PhosphorIconsRegular.trash : PhosphorIconsRegular.arrowCounterClockwise,
                    label: m.isActive ? 'Remove from this club' : 'Reactivate',
                    destructive: m.isActive,
                    onTap: () => _run(() => api.updateUserMembership(_u.id, m.id, {'status': m.isActive ? 'removed' : 'active'}),
                        m.isActive ? 'Removed from club' : 'Reactivated'),
                  ),
                ]),
              ),
          ]),
        SectionLabel(
          'Director roles',
          trailing: GestureDetector(
            onTap: () => showFormSheet<void>(context, builder: (_) => _AssignDirectorForm(userId: _u.id)).then((_) => _reload()),
            child: Text('Assign', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.ink)),
          ),
        ),
        if (_assignments == null)
          const SkeletonBox(height: 60)
        else if (_assignments!.isEmpty)
          AppCard(child: Text('No Director roles assigned.', style: t.bodySmall))
        else
          GroupCard(children: [
            for (final a in _assignments!)
              RowTile(
                title: a.unitName,
                subtitle: a.role.replaceAll('Director', ' Director'),
                trailing: IconButton(
                  tooltip: 'Remove',
                  icon: Icon(PhosphorIconsRegular.x, color: c.danger, size: 18),
                  onPressed: () async {
                    final ok = await confirmDialog(context, title: 'Remove this Director assignment?', confirmLabel: 'Remove', destructive: true);
                    if (ok) await _run(() => api.removeUserOrgAssignment(_u.id, a.id), 'Assignment removed');
                  },
                ),
              ),
          ]),
      ]),
    );
  }
}

class _UserProfileForm extends ConsumerStatefulWidget {
  const _UserProfileForm({required this.user});
  final PlatformUser user;
  @override
  ConsumerState<_UserProfileForm> createState() => _UserProfileFormState();
}

class _UserProfileFormState extends ConsumerState<_UserProfileForm> {
  late final _name = TextEditingController(text: widget.user.name);
  late final _email = TextEditingController(text: widget.user.email ?? '');
  late final _phone = TextEditingController(text: widget.user.phone);
  late final _ti = TextEditingController(text: widget.user.tiMemberNumber ?? '');
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _ti]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (validatePhone(_phone.text) != null) {
      showToast(context, 'Phone must be 11 digits', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).updateUser(widget.user.id, {
        'name': _name.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        if (_phone.text.trim() != widget.user.phone) 'phone': _phone.text.trim(),
        'tiMemberNumber': _ti.text.trim(),
      });
      if (!mounted) return;
      showToast(context, 'Profile saved');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => SheetScaffold(
        title: 'Edit profile',
        primaryLabel: 'Save profile',
        busy: _busy,
        onPrimary: _save,
        children: [
          const FieldLabel('Full name'),
          TextField(controller: _name, textCapitalization: TextCapitalization.words),
          const FieldLabel('Email', optional: true),
          TextField(controller: _email, keyboardType: TextInputType.emailAddress),
          const FieldLabel('Phone'),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
          ),
          const FieldLabel('TI member number', optional: true),
          TextField(controller: _ti, maxLength: 40, decoration: const InputDecoration(counterText: '')),
        ],
      );
}

class _AddMembershipForm extends ConsumerStatefulWidget {
  const _AddMembershipForm({required this.userId, required this.clubs});
  final String userId;
  final List<OrgNode> clubs;
  @override
  ConsumerState<_AddMembershipForm> createState() => _AddMembershipFormState();
}

class _AddMembershipFormState extends ConsumerState<_AddMembershipForm> {
  String? _clubId;
  Set<String> _roles = {'Member'};
  bool _admin = false;
  String _type = 'new';
  bool _busy = false;

  Future<void> _save() async {
    if (_clubId == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).addUserMembership(widget.userId, {
        'clubId': _clubId,
        'roles': _roles.toList(),
        'isClubAdmin': _admin,
        'memberType': _type,
      });
      if (!mounted) return;
      showToast(context, 'Added to club');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => SheetScaffold(
        title: 'Add to club',
        primaryLabel: 'Add',
        busy: _busy,
        onPrimary: _clubId == null ? null : _save,
        children: [
          const FieldLabel('Club'),
          DropdownButtonFormField<String>(
            initialValue: _clubId,
            isExpanded: true,
            hint: const Text('Select a club'),
            items: [for (final x in widget.clubs) DropdownMenuItem(value: x.id, child: Text(x.name, overflow: TextOverflow.ellipsis))],
            onChanged: (v) => setState(() => _clubId = v),
          ),
          const FieldLabel('Roles'),
          RolePicker(value: _roles, onChanged: (v) => setState(() => _roles = v)),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Club Admin — full access to this club'),
            value: _admin,
            onChanged: (v) => setState(() => _admin = v),
          ),
          const FieldLabel('Member type'),
          Wrap(spacing: 8, children: [
            ChoiceChip(label: const Text('New member'), selected: _type == 'new', onSelected: (_) => setState(() => _type = 'new')),
            ChoiceChip(label: const Text('Existing member'), selected: _type == 'existing', onSelected: (_) => setState(() => _type = 'existing')),
          ]),
        ],
      );
}

class _EditMembershipForm extends ConsumerStatefulWidget {
  const _EditMembershipForm({required this.userId, required this.member});
  final String userId;
  final Member member;
  @override
  ConsumerState<_EditMembershipForm> createState() => _EditMembershipFormState();
}

class _EditMembershipFormState extends ConsumerState<_EditMembershipForm> {
  late Set<String> _roles = widget.member.roles.map((r) => clubToOfficer[r]).whereType<String>().toSet();
  bool _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).updateUserMembership(widget.userId, widget.member.id, {'roles': _roles.toList()});
      if (!mounted) return;
      showToast(context, 'Membership updated');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => SheetScaffold(
        title: 'Edit roles',
        primaryLabel: 'Save',
        busy: _busy,
        onPrimary: _save,
        children: [RolePicker(value: _roles, onChanged: (v) => setState(() => _roles = v))],
      );
}

class _AssignDirectorForm extends ConsumerStatefulWidget {
  const _AssignDirectorForm({required this.userId});
  final String userId;
  @override
  ConsumerState<_AssignDirectorForm> createState() => _AssignDirectorFormState();
}

class _AssignDirectorFormState extends ConsumerState<_AssignDirectorForm> {
  OrgLevel _level = OrgLevel.district;
  String? _unitId;
  bool _busy = false;

  Future<void> _save() async {
    if (_unitId == null) return;
    setState(() => _busy = true);
    final role = switch (_level) {
      OrgLevel.district => 'DistrictDirector',
      OrgLevel.division => 'DivisionDirector',
      _ => 'AreaDirector',
    };
    try {
      await ref.read(apiProvider).addUserOrgAssignment(widget.userId, role: role, unitType: _level.label.toLowerCase(), unitId: _unitId!);
      if (!mounted) return;
      showToast(context, 'Director role assigned');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final units = ref.watch(orgListProvider((level: _level, parentId: null))).value ?? const <OrgNode>[];
    return SheetScaffold(
      title: 'Assign Director role',
      primaryLabel: 'Assign',
      busy: _busy,
      onPrimary: _unitId == null ? null : _save,
      children: [
        const FieldLabel('Level'),
        Wrap(spacing: 8, children: [
          for (final l in const [OrgLevel.district, OrgLevel.division, OrgLevel.area])
            ChoiceChip(
              label: Text('${l.label} Director'),
              selected: _level == l,
              onSelected: (_) => setState(() {
                _level = l;
                _unitId = null;
              }),
            ),
        ]),
        FieldLabel(_level.label),
        DropdownButtonFormField<String>(
          key: ValueKey(_level),
          initialValue: _unitId,
          isExpanded: true,
          hint: Text('Select a ${_level.label.toLowerCase()}'),
          items: [for (final u in units) DropdownMenuItem(value: u.id, child: Text(u.name))],
          onChanged: (v) => setState(() => _unitId = v),
        ),
      ],
    );
  }
}

/// Create a platform user and show their credentials once.
class CreateUserScreen extends ConsumerStatefulWidget {
  const CreateUserScreen({super.key});
  @override
  ConsumerState<CreateUserScreen> createState() => _CreateUserScreenState();
}

class _CreateUserScreenState extends ConsumerState<CreateUserScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _ti = TextEditingController();
  final _password = TextEditingController(text: generatePassword());
  String? _clubId;
  Set<String> _roles = {'Member'};
  bool _admin = false;
  String _type = 'new';
  bool _busy = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _ti, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _create() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).createUser({
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'password': _password.text,
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        if (_ti.text.trim().isNotEmpty) 'tiMemberNumber': _ti.text.trim(),
        if (_clubId != null) ...{'clubId': _clubId, 'roles': _roles.toList(), 'isClubAdmin': _admin, 'memberType': _type},
      });
      setState(() => _result = r);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final clubs = ref.watch(_allClubsProvider).value ?? const <OrgNode>[];
    if (_result != null) {
      final token = (_result!['credentialShare'] as Map?)?['token'];
      final link = token == null ? null : '${AppConfig.webOrigin}/credentials/${_result!['id']}?t=$token';
      final creds = 'Open Floor sign-in\nPhone: ${_phone.text.trim()}\nPassword: ${_password.text}';
      return Scaffold(
        appBar: AppBar(title: const Text('Account created'), automaticallyImplyLeading: false),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          Text('Share these with ${_name.text.trim()} — the password is shown only now.', style: t.bodyMedium),
          const SizedBox(height: 16),
          AppCard(margin: EdgeInsets.zero, child: SelectableText(creds, style: t.titleMedium)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => copyText(context, creds, 'Credentials copied'),
            icon: const Icon(PhosphorIconsRegular.copy, size: 18),
            label: const Text('Copy credentials'),
          ),
          if (link != null) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => shareText(context, link),
              icon: const Icon(PhosphorIconsRegular.linkSimple, size: 18),
              label: const Text('Share one-time direct link'),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Done')),
        ]),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add a new user'),
        actions: [
          TextButton(
            onPressed: _busy ? null : _create,
            child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Create'),
          ),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 40), children: [
          const FieldLabel('Full name'),
          TextFormField(controller: _name, textCapitalization: TextCapitalization.words, validator: (v) => (v ?? '').trim().isEmpty ? 'Enter a name' : null),
          const FieldLabel('Phone'),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
            validator: validatePhone,
          ),
          const FieldLabel('Email', optional: true),
          TextFormField(controller: _email, keyboardType: TextInputType.emailAddress),
          const FieldLabel('TI member number', optional: true),
          TextFormField(controller: _ti, maxLength: 40, decoration: const InputDecoration(counterText: '')),
          const FieldLabel('Password'),
          TextFormField(
            controller: _password,
            validator: (v) => (v ?? '').length < 8 ? 'At least 8 characters' : null,
            decoration: InputDecoration(
              helperText: 'Shown once after creation — copy it before closing.',
              suffixIcon: IconButton(
                tooltip: 'Generate a new password',
                icon: const Icon(PhosphorIconsRegular.arrowsClockwise),
                onPressed: () => setState(() => _password.text = generatePassword()),
              ),
            ),
          ),
          const SectionLabel('Place in a club', padding: EdgeInsets.fromLTRB(0, 24, 0, 6)),
          DropdownButtonFormField<String?>(
            initialValue: _clubId,
            isExpanded: true,
            hint: const Text('No club for now'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('No club for now')),
              for (final x in clubs) DropdownMenuItem<String?>(value: x.id, child: Text(x.name, overflow: TextOverflow.ellipsis)),
            ],
            onChanged: (v) => setState(() => _clubId = v),
          ),
          if (_clubId != null) ...[
            const FieldLabel('Roles'),
            RolePicker(value: _roles, onChanged: (v) => setState(() => _roles = v)),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Club Admin — full access to this club'),
              value: _admin,
              onChanged: (v) => setState(() => _admin = v),
            ),
            const FieldLabel('Member type'),
            Wrap(spacing: 8, children: [
              ChoiceChip(label: const Text('New member'), selected: _type == 'new', onSelected: (_) => setState(() => _type = 'new')),
              ChoiceChip(label: const Text('Existing member'), selected: _type == 'existing', onSelected: (_) => setState(() => _type = 'existing')),
            ]),
          ],
        ]),
      ),
    );
  }
}
