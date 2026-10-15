import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';
import '../meetings/meeting_common.dart';

/// "Add guest" chooser: add manually (number first) or share the sign-up link.
Future<void> showAddGuestSheet(BuildContext context, WidgetRef ref) {
  return showActionSheet(context, title: 'Add guest', actions: [
    SheetAction(
      icon: PhosphorIconsRegular.userPlus,
      label: 'Add manually',
      subtitle: 'Type their number — if we’ve met them before, details fill in for you.',
      onTap: () async {
        final created = await showFormSheet<Guest>(context, builder: (_) => const _AddGuestForm());
        if (created != null && context.mounted) {
          showToast(context, '${created.name} added to the guest list');
          context.push('/people/guests/${created.id}');
        }
      },
    ),
    SheetAction(
      icon: PhosphorIconsRegular.qrCode,
      label: 'Send invitation link',
      subtitle: 'Share a link or QR code — guests fill in their own details.',
      onTap: () => _showInviteLink(context, ref),
    ),
  ]);
}

Future<void> _showInviteLink(BuildContext context, WidgetRef ref) async {
  try {
    final token = await ref.read(apiProvider).guestInviteToken();
    if (token == null || !context.mounted) return;
    await showQrSheet(
      context,
      title: 'Guest sign-up link',
      helper: 'Visitors scan this to leave their name and number. The club gets them as a New guest.',
      url: MeetingLinks.guestInvite(token),
    );
  } catch (e) {
    if (context.mounted) showToast(context, errorText(e), error: true);
  }
}

class _AddGuestForm extends ConsumerStatefulWidget {
  const _AddGuestForm();
  @override
  ConsumerState<_AddGuestForm> createState() => _AddGuestFormState();
}

class _AddGuestFormState extends ConsumerState<_AddGuestForm> {
  final _form = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _whatsapp = TextEditingController();
  final _invitedBy = TextEditingController();
  PersonLookup? _lookup;
  bool _checked = false;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_phone, _name, _email, _whatsapp, _invitedBy]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _check() async {
    final err = validatePhone(_phone.text);
    if (err != null) {
      _form.currentState!.validate();
      return;
    }
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).lookupPhone(_phone.text.trim());
      setState(() {
        _lookup = r;
        _checked = true;
        if (r.found) {
          _name.text = fullName(r.firstName, r.lastName);
          _email.text = r.email ?? '';
          _whatsapp.text = r.whatsapp == _phone.text.trim() ? '' : (r.whatsapp ?? '');
        }
      });
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final g = await ref.read(apiProvider).createGuest({
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        if (_whatsapp.text.trim().isNotEmpty) 'whatsapp': _whatsapp.text.trim(),
        if (_invitedBy.text.trim().isNotEmpty) 'invitedBy': _invitedBy.text.trim(),
      });
      HapticFeedback.mediumImpact();
      ref.invalidate(guestsProvider);
      if (mounted) Navigator.pop(context, g);
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final l = _lookup;
    final blocked = l != null && (l.memberOfYourClub || l.guestInYourClubId != null);

    return Form(
      key: _form,
      child: SheetScaffold(
        title: 'Add guest',
        subtitle: _checked ? null : 'Start with their mobile number.',
        primaryLabel: blocked ? null : (_checked ? 'Add guest' : 'Continue'),
        busy: _busy,
        onPrimary: _checked ? _save : _check,
        children: [
          const FieldLabel('Mobile number'),
          TextFormField(
            controller: _phone,
            autofocus: true,
            enabled: !_checked,
            keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
            validator: validatePhone,
            onFieldSubmitted: (_) => _checked ? null : _check(),
            decoration: InputDecoration(
              hintText: '01XXXXXXXXX',
              suffixIcon: _checked
                  ? TextButton(
                      onPressed: () => setState(() {
                        _checked = false;
                        _lookup = null;
                      }),
                      child: const Text('Change'),
                    )
                  : null,
            ),
          ),
          if (l != null && l.memberOfYourClub)
            _Notice(icon: PhosphorIconsRegular.info, text: 'Already a member of this club — no need to add them as a guest.', color: c.inkSoft),
          if (l != null && l.guestInYourClubId != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                _Notice(icon: PhosphorIconsRegular.info, text: 'This number is already on your guest list.', color: c.inkSoft),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    context.push('/people/guests/${l.guestInYourClubId}');
                  },
                  child: const Text('Open profile'),
                ),
              ]),
            ),
          if (_checked && !blocked) ...[
            if (l != null && l.found)
              _Notice(
                icon: PhosphorIconsRegular.sparkle,
                text: l.claimed
                    ? 'Has an Open Floor account — we filled in what we know.'
                    : 'Known to another club — we filled in what we know.',
                color: c.success,
              ),
            const FieldLabel('Full name'),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              validator: (v) => (v ?? '').trim().isEmpty ? 'Enter their name' : null,
              decoration: const InputDecoration(hintText: 'e.g. Sayem Billah'),
            ),
            const FieldLabel('Email', optional: true),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              validator: (v) => (v ?? '').trim().isNotEmpty && !(v!.contains('@')) ? 'That does not look like an email' : null,
              decoration: const InputDecoration(hintText: 'name@example.com'),
            ),
            const FieldLabel('WhatsApp number', optional: true),
            TextFormField(
              controller: _whatsapp,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
              validator: (v) => validatePhone(v, required: false),
              decoration: const InputDecoration(hintText: 'Leave blank if same as phone'),
            ),
            const FieldLabel('Invited by', optional: true),
            TextFormField(
              controller: _invitedBy,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(hintText: 'Who brought them along?'),
            ),
          ],
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.text, required this.color});
  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(fontSize: 13.5, color: color))),
      ]),
    );
  }
}
