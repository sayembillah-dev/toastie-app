import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';
import 'add_guest_sheet.dart';
import 'guest_actions.dart';

enum _Tab { guests, members }

class PeopleScreen extends ConsumerStatefulWidget {
  const PeopleScreen({super.key});
  @override
  ConsumerState<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends ConsumerState<PeopleScreen> {
  _Tab? _tab;
  String? _stage; // null = all
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final can = ref.watch(canProvider);
    final canGuests = can(Act.read, 'guest');
    final canMembers = can(Act.read, 'member');
    if (!canGuests && !canMembers) return const AccessRestricted(title: 'People');
    final tab = _tab ?? (canGuests ? _Tab.guests : _Tab.members);

    return Scaffold(
      appBar: AppBar(title: const Text('People')),
      floatingActionButton: tab == _Tab.guests && can(Act.create, 'guest')
          ? FloatingActionButton.extended(
              onPressed: () => showAddGuestSheet(context, ref),
              icon: const Icon(PhosphorIconsBold.userPlus),
              label: const Text('Add guest'),
              shape: const StadiumBorder(),
            )
          : null,
      body: Column(children: [
        if (canGuests && canMembers)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<_Tab>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: _Tab.guests, label: Text('Guests')),
                  ButtonSegment(value: _Tab.members, label: Text('Members')),
                ],
                selected: {tab},
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
              hintText: tab == _Tab.guests ? 'Search guests, emails, inviters' : 'Search members',
              prefixIcon: const Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
              suffixIcon: _q.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => setState(() => _q.clear()),
                    ),
            ),
          ),
        ),
        Expanded(child: tab == _Tab.guests ? _guests() : _members()),
      ]),
    );
  }

  Widget _guests() {
    final guests = ref.watch(guestsProvider);
    final c = AppColors.of(context);
    final canEdit = ref.watch(canProvider)(Act.update, 'guest');
    return RefreshIndicator(
      onRefresh: () => ref.refresh(guestsProvider.future),
      child: AsyncBody<List<Guest>>(
        value: guests,
        errorTitle: 'Could not load the guest list',
        onRetry: () => ref.invalidate(guestsProvider),
        builder: (all) {
          final q = _q.text.trim().toLowerCase();
          final searched = all.where((g) =>
              q.isEmpty ||
              g.name.toLowerCase().contains(q) ||
              (g.email ?? '').toLowerCase().contains(q) ||
              (g.invitedBy ?? '').toLowerCase().contains(q) ||
              (g.phone ?? '').contains(q));
          final counts = <String, int>{};
          for (final g in searched) {
            counts[g.stage] = (counts[g.stage] ?? 0) + 1;
          }
          final list = searched.where((g) => _stage == null || g.stage == _stage).toList()
            ..sort((a, b) {
              final s = GuestStage.fromId(a.stage).index.compareTo(GuestStage.fromId(b.stage).index);
              return s != 0 ? s : a.name.toLowerCase().compareTo(b.name.toLowerCase());
            });

          return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 100), children: [
            SizedBox(
              height: 44,
              child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text('All ${searched.length}'),
                    selected: _stage == null,
                    onSelected: (_) => setState(() => _stage = null),
                  ),
                ),
                for (final st in GuestStage.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      avatar: CircleAvatar(backgroundColor: st.accent, radius: 4),
                      label: Text('${st.label} ${counts[st.id] ?? 0}'),
                      selected: _stage == st.id,
                      onSelected: (_) => setState(() => _stage = _stage == st.id ? null : st.id),
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 8),
            if (list.isEmpty)
              EmptyState(
                icon: PhosphorIconsRegular.usersThree,
                title: all.isEmpty ? 'No guests logged yet' : 'No guests here',
                message: all.isEmpty ? 'Add one after a meeting to start keeping in touch.' : 'Try a different stage or search.',
              )
            else
              for (final g in list)
                Dismissible(
                  key: ValueKey('g-${g.id}-${g.stage}'),
                  direction: DismissDirection.horizontal,
                  confirmDismiss: (dir) async {
                    if (dir == DismissDirection.startToEnd && canEdit) {
                      await showMoveStageSheet(context, ref, g);
                    } else if (dir == DismissDirection.endToStart) {
                      _contactSheet(g);
                    }
                    return false;
                  },
                  background: Container(
                    color: c.fill,
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.only(left: 24),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(PhosphorIconsRegular.arrowsLeftRight, color: c.ink),
                      const SizedBox(width: 8),
                      const Text('Move stage', style: TextStyle(fontWeight: FontWeight.w600)),
                    ]),
                  ),
                  secondaryBackground: Container(
                    color: c.successSoft,
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 24),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text('Contact', style: TextStyle(fontWeight: FontWeight.w600, color: c.success)),
                      const SizedBox(width: 8),
                      Icon(PhosphorIconsRegular.phone, color: c.success),
                    ]),
                  ),
                  child: _GuestRow(guest: g, onTap: () => context.push('/people/guests/${g.id}')),
                ),
          ]);
        },
      ),
    );
  }

  void _contactSheet(Guest g) {
    final phone = g.phone;
    final wa = g.whatsapp ?? g.phone;
    showActionSheet(context, title: g.name, actions: [
      if (phone != null)
        SheetAction(icon: PhosphorIconsRegular.phone, label: 'Call', subtitle: phone, onTap: () => launchUrl(Uri.parse('tel:$phone'))),
      if (wa != null)
        SheetAction(
          icon: PhosphorIconsRegular.whatsappLogo,
          label: 'WhatsApp',
          subtitle: wa,
          onTap: () => launchUrl(whatsappUri(wa), mode: LaunchMode.externalApplication),
        ),
      if (g.email != null)
        SheetAction(icon: PhosphorIconsRegular.envelope, label: 'Email', subtitle: g.email, onTap: () => launchUrl(Uri.parse('mailto:${g.email}'))),
      if (phone == null && wa == null && g.email == null)
        SheetAction(icon: PhosphorIconsRegular.info, label: 'No contact details on file', onTap: () {}),
    ]);
  }

  Widget _members() {
    final members = ref.watch(membersProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(membersProvider.future),
      child: AsyncBody<List<Member>>(
        value: members,
        errorTitle: 'Could not load the roster',
        onRetry: () => ref.invalidate(membersProvider),
        builder: (all) {
          final q = _q.text.trim().toLowerCase();
          final list = all.where((m) => m.isActive && (q.isEmpty || m.name.toLowerCase().contains(q))).toList();
          if (list.isEmpty) {
            return ListView(children: const [EmptyState(icon: PhosphorIconsRegular.users, title: 'No members match')]);
          }
          return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.only(bottom: 32), children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Text('${list.length} active members', style: Theme.of(context).textTheme.bodySmall),
            ),
            GroupCard(children: [
              for (final m in list)
                RowTile(
                  leading: Avatar(name: m.name, url: m.avatarUrl, size: 40),
                  title: m.name,
                  subtitle: [
                    m.rolesLabel,
                    m.pathway == null ? 'No pathway yet' : '${m.pathway} · L${m.level ?? 1}',
                  ].join(' · '),
                  trailing: m.isClubAdmin ? const Pill('Admin') : const Chevron(),
                  onTap: () => context.push('/people/members/${m.id}'),
                ),
            ]),
          ]);
        },
      ),
    );
  }
}

class _GuestRow extends StatelessWidget {
  const _GuestRow({required this.guest, required this.onTap});
  final Guest guest;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final st = GuestStage.fromId(guest.stage);
    return Material(
      color: c.canvas,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.line))),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(children: [
            Avatar(name: guest.name, url: guest.avatarUrl, size: 42),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(guest.name, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  [guest.visitsLabel, if (guest.invitedBy != null) 'Invited by ${guest.invitedBy}'].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: c.inkMuted),
                ),
              ]),
            ),
            const SizedBox(width: 8),
            Pill(st.label, color: st.accent, background: st.soft),
          ]),
        ),
      ),
    );
  }
}
