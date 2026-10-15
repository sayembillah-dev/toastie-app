import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../app/shell.dart';
import '../../core/access/access.dart';
import '../../core/bd_time.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/toastie_api_admin.dart';
import '../../ui/icons.dart';
import '../../ui/photo_picker.dart';
import '../../ui/widgets.dart';
import '../people/guest_profile_screen.dart' show SocialsEditor;

final _clubRawProvider = FutureProvider<Map<String, dynamic>>((ref) {
  ref.watch(contextKeyProvider);
  return ref.watch(apiProvider).clubProfileRaw();
});

const _bannerSwatches = [
  '#772432', '#004165', '#1B2740', '#2E7D32', '#6A1B9A', '#C62828', '#EF6C00', '#00838F', '#37474F', '#1C1C1C',
];

/// Club profile (PRD §12.4).
class ClubProfileScreen extends ConsumerStatefulWidget {
  const ClubProfileScreen({super.key});
  @override
  ConsumerState<ClubProfileScreen> createState() => _ClubProfileScreenState();
}

class _ClubProfileScreenState extends ConsumerState<ClubProfileScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _number = TextEditingController();
  final _motto = TextEditingController();
  final _venue = TextEditingController();
  final _map = TextEditingController();
  final _phone = TextEditingController();
  List<Social> _socials = [];
  String? _banner;
  String? _bannerImage; // existing value (URL)
  PickedPhoto? _newBanner;
  bool _bannerImageCleared = false;
  bool _hydrated = false;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_name, _number, _motto, _venue, _map, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  void _hydrate(Map<String, dynamic> j) {
    if (_hydrated) return;
    _hydrated = true;
    _name.text = '${j['name'] ?? ''}';
    _number.text = '${j['clubNumber'] ?? ''}';
    _motto.text = '${j['motto'] ?? ''}';
    _venue.text = '${j['venueAddress'] ?? ''}';
    _map.text = '${j['venueMapUrl'] ?? ''}';
    _phone.text = '${j['contactPhone'] ?? ''}';
    _banner = j['bannerColor'] as String?;
    _bannerImage = j['bannerImage'] as String?;
    _socials = [
      for (final s in (j['socials'] as List? ?? const []))
        if (s is Map) Social(platform: '${s['platform']}', url: '${s['url']}'),
    ];
  }

  String? _orNull(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final api = ref.read(apiProvider);
      String? bannerImage;
      var sendImage = false;
      if (_newBanner != null) {
        bannerImage = await api.upload(_newBanner!.bytes, surface: 'clubBanner', mimeType: _newBanner!.mimeType);
        sendImage = true;
      } else if (_bannerImageCleared) {
        sendImage = true;
      }
      await api.updateClubProfile({
        'name': _name.text.trim(),
        'clubNumber': _orNull(_number),
        'motto': _orNull(_motto),
        'venueAddress': _orNull(_venue),
        'venueMapUrl': _orNull(_map),
        'contactPhone': _orNull(_phone),
        'bannerColor': _banner,
        if (sendImage) 'bannerImage': bannerImage,
        if (sendImage && bannerImage != null) 'bannerImagePos': {'x': 50, 'y': 50, 'zoom': 1},
        'socials': _socials.where((s) => s.url.trim().isNotEmpty).map((s) => s.toJson()).toList(),
      });
      HapticFeedback.mediumImpact();
      ref.invalidate(_clubRawProvider);
      ref.invalidate(clubProvider);
      if (!mounted) return;
      showToast(context, 'Club profile saved');
      context.pop();
    } catch (e) {
      if (mounted) showToast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(canProvider)(Act.update, 'club')) return const AccessRestricted(title: 'Club profile');
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    final raw = ref.watch(_clubRawProvider);
    final club = ref.watch(clubProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Club profile'),
        actions: [
          TextButton(
            onPressed: _busy || !_hydrated ? null : _save,
            child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save'),
          ),
        ],
      ),
      body: AsyncBody<Map<String, dynamic>>(
        value: raw,
        errorTitle: 'Could not load the club profile',
        onRetry: () => ref.invalidate(_clubRawProvider),
        builder: (j) {
          _hydrate(j);
          final bannerColor = _banner == null ? null : Color(0xFF000000 | int.parse(_banner!.substring(1), radix: 16));
          final showImage = _newBanner != null || (!_bannerImageCleared && _bannerImage != null && _bannerImage!.isNotEmpty);
          return Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                Text('What members and prospects see about your club.', style: t.bodySmall),
                const FieldLabel('Club name'),
                TextFormField(controller: _name, validator: (v) => (v ?? '').trim().isEmpty ? 'Enter the club name' : null),
                const FieldLabel('Club number', optional: true),
                TextFormField(controller: _number, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'e.g. 1234567')),
                const FieldLabel('Motto', optional: true),
                TextFormField(controller: _motto, maxLength: 300, maxLines: 2, minLines: 1),
                const FieldLabel('Venue address', optional: true),
                TextFormField(controller: _venue, maxLength: 500, maxLines: 3, minLines: 1, decoration: const InputDecoration(hintText: 'Where the club meets')),
                const FieldLabel('Google Maps link', optional: true),
                TextFormField(controller: _map, keyboardType: TextInputType.url, decoration: const InputDecoration(hintText: 'https://maps.google.com/…')),
                const FieldLabel('Contact phone', optional: true),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                  validator: (v) => validatePhone(v, required: false),
                ),
                const FieldLabel('Official social links', optional: true),
                SocialsEditor(value: _socials, onChanged: (v) => setState(() => _socials = v)),
                const SectionLabel('Agenda banner', padding: EdgeInsets.fromLTRB(0, 24, 0, 6)),
                Text('Printed at the top of every agenda. An image wins over the colour.', style: t.bodySmall),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 110,
                    decoration: BoxDecoration(
                      color: bannerColor,
                      gradient: bannerColor == null ? LinearGradient(colors: [c.heroStart, c.heroEnd]) : null,
                    ),
                    child: showImage
                        ? (_newBanner != null
                            ? Image.memory(_newBanner!.bytes, fit: BoxFit.cover, width: double.infinity)
                            : Image.network(_bannerImage!, fit: BoxFit.cover, width: double.infinity, errorBuilder: (_, _, _) => const SizedBox()))
                        : Center(child: Text(club?.name ?? _name.text, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700))),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  GestureDetector(
                    onTap: () => setState(() => _banner = null),
                    child: _Swatch(color: null, selected: _banner == null),
                  ),
                  for (final hex in _bannerSwatches)
                    GestureDetector(
                      onTap: () => setState(() => _banner = hex),
                      child: _Swatch(color: Color(0xFF000000 | int.parse(hex.substring(1), radix: 16)), selected: _banner?.toUpperCase() == hex),
                    ),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  OutlinedButton.icon(
                    onPressed: () async {
                      final p = await pickPhoto(context, maxSide: 2000);
                      if (p != null) {
                        setState(() {
                          _newBanner = p;
                          _bannerImageCleared = false;
                        });
                      }
                    },
                    icon: const Icon(PhosphorIconsRegular.image, size: 18),
                    label: Text(showImage ? 'Replace image' : 'Custom banner image'),
                  ),
                  if (showImage) ...[
                    const SizedBox(width: 8),
                    TextButton(
                      style: TextButton.styleFrom(foregroundColor: c.danger),
                      onPressed: () => setState(() {
                        _newBanner = null;
                        _bannerImageCleared = true;
                      }),
                      child: const Text('Remove'),
                    ),
                  ],
                ]),
                const SizedBox(height: 4),
                Text('Wide images work best. Fine-tune the crop on the web.', style: t.bodySmall),
                const SectionLabel('Organization', padding: EdgeInsets.fromLTRB(0, 24, 0, 6)),
                Text([club?.areaName, club?.divisionName, club?.districtName].whereType<String>().join(' · '), style: t.bodyMedium),
                Text('Managed by your District/Division/Area leadership.', style: t.bodySmall),
                if (j['updatedAt'] is String) ...[
                  const SizedBox(height: 16),
                  Text('Last updated ${BdTime.meeting(DateTime.parse(j['updatedAt'] as String))}', style: t.bodySmall),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.color, required this.selected});
  final Color? color;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: color,
        gradient: color == null ? LinearGradient(colors: [c.heroStart, c.heroEnd]) : null,
        shape: BoxShape.circle,
        border: Border.all(color: selected ? c.ink : c.line, width: selected ? 3 : 1),
      ),
      child: color == null ? const Icon(PhosphorIconsRegular.prohibit, size: 14, color: Colors.white70) : null,
    );
  }
}
