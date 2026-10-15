import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';
import 'guest_actions.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/photo_picker.dart';

class GuestProfileScreen extends ConsumerWidget {
  const GuestProfileScreen({super.key, required this.guestId});
  final String guestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final guest = ref.watch(guestProvider(guestId));
    final can = ref.watch(canProvider);
    final canEdit = can(Act.update, 'guest');
    final canDelete = can(Act.delete, 'guest');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Guest'),
        actions: [
          if (guest.hasValue && (canEdit || canDelete))
            IconButton(
              tooltip: 'Guest actions',
              icon: const Icon(PhosphorIconsBold.dotsThreeVertical),
              onPressed: () {
                final g = guest.requireValue;
                showActionSheet(context, actions: [
                  if (canEdit)
                    SheetAction(icon: PhosphorIconsRegular.arrowsLeftRight, label: 'Move stage', onTap: () => showMoveStageSheet(context, ref, g)),
                  if (canEdit)
                    SheetAction(
                      icon: PhosphorIconsRegular.pencilSimple,
                      label: 'Edit',
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        fullscreenDialog: true,
                        builder: (_) => GuestEditScreen(guest: g),
                      )),
                    ),
                  if (canDelete)
                    SheetAction(
                      icon: PhosphorIconsRegular.trash,
                      label: 'Delete guest',
                      destructive: true,
                      onTap: () async {
                        final ok = await confirmDialog(context,
                            title: 'Delete ${g.name}?',
                            message: 'Their visit and contact logs are removed too.',
                            confirmLabel: 'Delete guest',
                            destructive: true);
                        if (!ok) return;
                        try {
                          await ref.read(apiProvider).deleteGuest(g.id);
                          ref.invalidate(guestsProvider);
                          if (!context.mounted) return;
                          showToast(context, '${g.name} was deleted');
                          context.pop();
                        } catch (e) {
                          if (context.mounted) showToast(context, errorText(e), error: true);
                        }
                      },
                    ),
                ]);
              },
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(guestProvider(guestId).future),
        child: AsyncBody<Guest>(
          value: guest,
          errorTitle: 'Could not load this guest',
          onRetry: () => ref.invalidate(guestProvider(guestId)),
          builder: (g) => _Body(guest: g, canEdit: canEdit),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.guest, required this.canEdit});
  final Guest guest;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final g = guest;
    final st = GuestStage.fromId(g.stage);
    final wa = g.whatsapp ?? g.phone;

    Widget action(IconData icon, String label, VoidCallback? onTap) => Expanded(
          child: Opacity(
            opacity: onTap == null ? 0.4 : 1,
            child: Material(
              color: c.canvas,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: c.line)),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Column(children: [
                    Icon(icon, size: 22, color: c.ink),
                    const SizedBox(height: 4),
                    Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  ]),
                ),
              ),
            ),
          ),
        );

    Widget info(String label, String? value, {bool clubOnly = false}) => value == null || value.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(label.toUpperCase(), style: t.labelSmall),
                if (clubOnly) ...[const SizedBox(width: 6), const Pill('Club-only')],
              ]),
              const SizedBox(height: 3),
              SelectableText(value, style: t.bodyMedium),
            ]),
          );

    final hasInfo = [g.phone, g.whatsapp, g.email, g.organization, g.bio, g.notes].any((v) => v != null && v.isNotEmpty) ||
        g.socials.isNotEmpty;

    return ListView(padding: const EdgeInsets.only(bottom: 40), children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(children: [
          Avatar(name: g.name, url: g.avatarUrl, size: 76),
          const SizedBox(height: 12),
          Text(g.name, style: t.headlineMedium, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: [
            GestureDetector(
              onTap: canEdit ? () => showMoveStageSheet(context, ref, g) : null,
              child: Pill(st.label, color: st.accent, background: st.soft, icon: canEdit ? PhosphorIconsBold.caretDown : null),
            ),
            if (g.sharedContact) const Pill('Shared contact', icon: PhosphorIconsRegular.link),
            Pill(g.visitsLabel),
          ]),
          if (g.invitedBy != null) ...[
            const SizedBox(height: 8),
            Text('Invited by ${g.invitedBy}', style: t.bodySmall),
          ],
        ]),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          action(PhosphorIconsRegular.phone, 'Call', g.phone == null ? null : () => launchUrl(Uri.parse('tel:${g.phone}'))),
          const SizedBox(width: 10),
          action(PhosphorIconsRegular.whatsappLogo, 'WhatsApp',
              wa == null ? null : () => launchUrl(whatsappUri(wa), mode: LaunchMode.externalApplication)),
          const SizedBox(width: 10),
          action(PhosphorIconsRegular.envelope, 'Email', g.email == null ? null : () => launchUrl(Uri.parse('mailto:${g.email}'))),
        ]),
      ),
      const SectionLabel('Information'),
      if (!hasInfo)
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Add details once you meet', style: t.titleMedium),
            Text('No phone number, socials, bio, or notes on file yet.', style: t.bodySmall),
          ]),
        )
      else
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            info('Phone', g.phone),
            if (g.whatsapp != null && g.whatsapp != g.phone) info('WhatsApp', g.whatsapp),
            info('Email', g.email),
            info('Organization / profession', g.organization),
            info('Bio', g.bio),
            if (g.socials.isNotEmpty)
              info('Socials', g.socials.map((s) => '${socialPlatforms[s.platform] ?? s.platform}: ${s.url}').join('\n')),
            info('Notes', g.notes, clubOnly: true),
          ]),
        ),
      const SectionLabel('Activity'),
      GroupCard(children: [
        RowTile(
          leading: const Icon(PhosphorIconsRegular.calendarCheck),
          title: 'Visit logs',
          subtitle: g.visitsLabel,
          trailing: const Chevron(),
          onTap: () => context.push('/people/guests/${g.id}/visits'),
        ),
        RowTile(
          leading: const Icon(PhosphorIconsRegular.chatsCircle),
          title: 'Contact logs',
          subtitle: 'Calls, messages and catch-ups',
          trailing: const Chevron(),
          onTap: () => context.push('/people/guests/${g.id}/contacts'),
        ),
      ]),
    ]);
  }
}

/// Edit guest — a pushed full-screen form (PRD §8.2).
class GuestEditScreen extends ConsumerStatefulWidget {
  const GuestEditScreen({super.key, required this.guest});
  final Guest guest;
  @override
  ConsumerState<GuestEditScreen> createState() => _GuestEditScreenState();
}

class _GuestEditScreenState extends ConsumerState<GuestEditScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.guest.name == 'Unnamed guest' ? '' : widget.guest.name);
  late final _email = TextEditingController(text: widget.guest.email ?? '');
  late final _phone = TextEditingController(text: widget.guest.phone ?? '');
  late final _whatsapp = TextEditingController(text: widget.guest.whatsapp ?? '');
  late final _org = TextEditingController(text: widget.guest.organization ?? '');
  late final _invitedBy = TextEditingController(text: widget.guest.invitedBy ?? '');
  late final _bio = TextEditingController(text: widget.guest.bio ?? '');
  late final _notes = TextEditingController(text: widget.guest.notes ?? '');
  late bool _sameWa = widget.guest.whatsapp == null || widget.guest.whatsapp == widget.guest.phone;
  late List<Social> _socials = [...widget.guest.socials];
  bool _busy = false;
  PickedPhoto? _photo;
  bool _photoCleared = false;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _whatsapp, _org, _invitedBy, _bio, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      String? avatarUrl;
      if (_photo != null) {
        avatarUrl = await ref.read(apiProvider).upload(_photo!.bytes, surface: 'guestAvatar', mimeType: _photo!.mimeType);
      } else if (_photoCleared) {
        avatarUrl = '';
      }
      await ref.read(apiProvider).updateGuest(widget.guest.id, {
        'avatarUrl': ?avatarUrl,
        'name': _name.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'whatsapp': _sameWa ? (_phone.text.trim().isEmpty ? null : _phone.text.trim()) : (_whatsapp.text.trim().isEmpty ? null : _whatsapp.text.trim()),
        'organization': _org.text.trim(),
        'invitedBy': _invitedBy.text.trim(),
        'bio': _bio.text.trim(),
        'notes': _notes.text.trim(),
        'socials': _socials.where((s) => s.url.trim().isNotEmpty).map((s) => s.toJson()).toList(),
      });
      HapticFeedback.mediumImpact();
      ref.invalidate(guestProvider(widget.guest.id));
      ref.invalidate(guestsProvider);
      if (!mounted) return;
      showToast(context, 'Guest details saved');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit guest'),
        leading: TextButton(onPressed: () => Navigator.pop(context), child: const Text('Discard')),
        leadingWidth: 90,
        actions: [
          TextButton(
            onPressed: _busy ? null : _save,
            child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save'),
          ),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            const SizedBox(height: 8),
            Center(
              child: EditableAvatar(
                name: widget.guest.name,
                url: widget.guest.avatarUrl,
                pending: _photo?.bytes,
                cleared: _photoCleared,
                size: 76,
                onTap: () async {
                  final hasPhoto = _photo != null || (!_photoCleared && widget.guest.avatarUrl != null);
                  final picked = await pickPhoto(
                    context,
                    onRemove: hasPhoto
                        ? () => setState(() {
                              _photo = null;
                              _photoCleared = true;
                            })
                        : null,
                  );
                  if (picked != null) {
                    setState(() {
                      _photo = picked;
                      _photoCleared = false;
                    });
                  }
                },
              ),
            ),
            const FieldLabel('Full name'),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              validator: (v) => (v ?? '').trim().isEmpty ? 'Enter a name' : null,
            ),
            const FieldLabel('Email', optional: true),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              validator: (v) => (v ?? '').trim().isNotEmpty && !(v!.contains('@')) ? 'That does not look like an email' : null,
            ),
            const FieldLabel('Phone', optional: true),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
              validator: (v) => validatePhone(v, required: false),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('WhatsApp is the same as the phone number', style: TextStyle(fontSize: 14.5)),
              value: _sameWa,
              onChanged: (v) => setState(() => _sameWa = v),
            ),
            if (!_sameWa) ...[
              const FieldLabel('WhatsApp number'),
              TextFormField(
                controller: _whatsapp,
                keyboardType: TextInputType.phone,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                validator: (v) => validatePhone(v, required: false),
              ),
            ],
            const FieldLabel('Organization / profession', optional: true),
            TextFormField(controller: _org, maxLength: 120, decoration: const InputDecoration(hintText: 'Where they work or what they do', counterText: '')),
            const FieldLabel('Invited by', optional: true),
            TextFormField(controller: _invitedBy, decoration: const InputDecoration(hintText: 'Who brought them along?')),
            const FieldLabel('Socials', optional: true),
            SocialsEditor(value: _socials, onChanged: (v) => setState(() => _socials = v)),
            const FieldLabel('Bio', optional: true),
            TextFormField(
              controller: _bio,
              maxLength: 600,
              maxLines: 4,
              minLines: 2,
              decoration: const InputDecoration(hintText: 'A few sentences the club can jog its memory with.'),
            ),
            const FieldLabel('Notes', optional: true),
            TextFormField(
              controller: _notes,
              maxLength: 1000,
              maxLines: 5,
              minLines: 2,
              decoration: const InputDecoration(
                hintText: 'Follow-ups, availability, anything the next officer should know.',
                helperText: 'Private — visible to club officers only.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Editable list of platform + URL rows (guests, profile).
class SocialsEditor extends StatelessWidget {
  const SocialsEditor({super.key, required this.value, required this.onChanged});
  final List<Social> value;
  final ValueChanged<List<Social>> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (var i = 0; i < value.length; i++)
        Padding(
          // Re-key when rows are added/removed so each field re-reads its
          // initial value; editing text keeps the same key (and focus).
          key: ValueKey('social-$i-of-${value.length}'),
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            PopupMenuButton<String>(
              initialValue: value[i].platform,
              onSelected: (p) {
                final next = [...value];
                next[i] = Social(platform: p, url: value[i].url);
                onChanged(next);
              },
              itemBuilder: (_) => [
                for (final e in socialPlatforms.entries) PopupMenuItem(value: e.key, child: Text(e.value)),
              ],
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
                decoration: BoxDecoration(border: Border.all(color: c.line), borderRadius: BorderRadius.circular(Radii.control)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(socialPlatforms[value[i].platform] ?? value[i].platform, style: const TextStyle(fontSize: 14)),
                  const Icon(PhosphorIconsRegular.caretDown, size: 14),
                ]),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                initialValue: value[i].url,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(hintText: 'https://…'),
                validator: (v) {
                  final s = (v ?? '').trim();
                  if (s.isEmpty) return 'URL is required';
                  if (!s.contains('.')) return 'That does not look like a URL';
                  return null;
                },
                onChanged: (v) {
                  final next = [...value];
                  next[i] = Social(platform: value[i].platform, url: v.trim());
                  onChanged(next);
                },
              ),
            ),
            IconButton(
              tooltip: 'Remove this social link',
              icon: Icon(PhosphorIconsRegular.x, color: c.inkMuted),
              onPressed: () => onChanged([...value]..removeAt(i)),
            ),
          ]),
        ),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: () => onChanged([...value, const Social(platform: 'linkedin', url: '')]),
          icon: const Icon(PhosphorIconsRegular.plus, size: 16),
          label: const Text('Add social link'),
        ),
      ),
    ]);
  }
}

String formatLogDate(String? iso) => iso == null ? '' : BdTime.meeting(DateTime.parse(iso));
