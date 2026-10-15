import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/bd_time.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';
import '../auth/auth_scaffold.dart';
import '../people/guest_profile_screen.dart' show SocialsEditor;
import '../../data/toastie_api_admin.dart';
import '../../ui/photo_picker.dart';

/// Edit profile (PRD §11.5). Changing email or phone needs the current
/// password.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});
  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _bio = TextEditingController();
  final _password = TextEditingController();
  List<Social> _socials = [];
  Profile? _orig;
  PickedPhoto? _photo;
  bool _photoCleared = false;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _bio, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  void _hydrate(Profile p) {
    if (_orig != null) return;
    _orig = p;
    _name.text = p.name;
    _email.text = p.email ?? '';
    _phone.text = p.phone;
    _bio.text = p.bio ?? '';
    _socials = [...p.socials];
  }

  bool get _sensitiveChanged =>
      _orig != null && (_email.text.trim() != (_orig!.email ?? '') || _phone.text.trim() != _orig!.phone);

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      String? avatarUrl;
      if (_photo != null) {
        avatarUrl = await ref.read(apiProvider).upload(_photo!.bytes, surface: 'avatar', mimeType: _photo!.mimeType);
      } else if (_photoCleared) {
        avatarUrl = '';
      }
      await ref.read(apiProvider).updateProfile({
        'avatarUrl': ?avatarUrl,
        'name': _name.text.trim(),
        if (_email.text.trim().isNotEmpty && _email.text.trim() != (_orig!.email ?? '')) 'email': _email.text.trim(),
        if (_phone.text.trim() != _orig!.phone) 'phone': _phone.text.trim(),
        'bio': _bio.text.trim(),
        'socials': _socials.where((s) => s.url.trim().isNotEmpty).map((s) => s.toJson()).toList(),
        if (_sensitiveChanged) 'currentPassword': _password.text,
      });
      HapticFeedback.mediumImpact();
      ref.invalidate(profileProvider);
      await ref.read(authProvider.notifier).refreshSession().catchError((_) {});
      if (!mounted) return;
      showToast(context, 'Profile saved');
      context.pop();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your profile'),
        actions: [
          TextButton(
            onPressed: _busy || _orig == null ? null : _save,
            child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save'),
          ),
        ],
      ),
      body: AsyncBody<Profile>(
        value: profile,
        errorTitle: 'Could not load your profile',
        onRetry: () => ref.invalidate(profileProvider),
        builder: (p) {
          _hydrate(p);
          return Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                Center(
                  child: EditableAvatar(
                    name: p.name,
                    url: p.avatarUrl,
                    pending: _photo?.bytes,
                    cleared: _photoCleared,
                    onTap: () async {
                      final hasPhoto = _photo != null || (!_photoCleared && p.avatarUrl != null);
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
                  validator: (v) => (v ?? '').trim().isEmpty ? 'Enter your name' : null,
                ),
                const FieldLabel('Email', optional: true),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  onChanged: (_) => setState(() {}),
                  validator: (v) => (v ?? '').trim().isNotEmpty && !(v!.contains('@')) ? 'That does not look like an email' : null,
                ),
                const FieldLabel('Phone'),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  onChanged: (_) => setState(() {}),
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                  validator: validatePhone,
                ),
                if (_sensitiveChanged) ...[
                  const FieldLabel('Current password'),
                  PasswordField(
                    controller: _password,
                    hint: 'Required to confirm an email or phone change',
                    validator: (v) => (v ?? '').isEmpty ? 'Enter your current password to confirm' : null,
                  ),
                ],
                const FieldLabel('Bio', optional: true),
                TextFormField(
                  controller: _bio,
                  maxLength: 1000,
                  maxLines: 5,
                  minLines: 3,
                  decoration: const InputDecoration(hintText: 'A few sentences other members can get to know you by.'),
                ),
                const FieldLabel('Social links', optional: true),
                SocialsEditor(value: _socials, onChanged: (v) => setState(() => _socials = v)),
                if (p.memberships.isNotEmpty) ...[
                  const SectionLabel('Your clubs', padding: EdgeInsets.fromLTRB(0, 24, 0, 8)),
                  for (final m in p.memberships)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        '${m.clubName}${m.pathway == null ? '' : ' · ${m.pathway} · Level ${m.level ?? 1} of 5'}',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  Text('Pathway and level are managed from the Learn tab.', style: Theme.of(context).textTheme.bodySmall),
                ],
                if (p.createdAt != null) ...[
                  const SizedBox(height: 16),
                  Text('On Open Floor since ${BdTime.date(DateTime.parse(p.createdAt!))}', style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
