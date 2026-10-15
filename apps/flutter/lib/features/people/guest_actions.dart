import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';

import '../../app/data.dart';
import '../../app/session.dart';
import '../../core/access/access.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../ui/widgets.dart';

/// wa.me link for a Bangladeshi number ("01XXXXXXXXX" → 8801XXXXXXXXX).
Uri whatsappUri(String phone) {
  var digits = phone.replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('0')) digits = '88$digits';
  return Uri.parse('https://wa.me/$digits');
}

/// Stage picker bottom sheet; includes "Convert to member" for admins.
Future<void> showMoveStageSheet(BuildContext context, WidgetRef ref, Guest g) async {
  final can = ref.read(canProvider);
  await showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (ctx) {
      final c = AppColors.of(ctx);
      return SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
            child: Text(g.name, style: Theme.of(ctx).textTheme.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text('Move to a different stage', style: Theme.of(ctx).textTheme.bodySmall),
          ),
          for (final st in GuestStage.values)
            ListTile(
              leading: CircleAvatar(radius: 6, backgroundColor: st.accent),
              title: Text(st.label),
              trailing: st.id == g.stage ? Icon(PhosphorIconsFill.checkCircle, color: c.success) : null,
              onTap: () async {
                Navigator.pop(ctx);
                if (st.id == g.stage) return;
                try {
                  await ref.read(apiProvider).updateGuest(g.id, {'stage': st.id});
                  HapticFeedback.lightImpact();
                  ref.invalidate(guestsProvider);
                  ref.invalidate(guestProvider(g.id));
                  if (context.mounted) showToast(context, '${g.name} moved to ${st.label}');
                } catch (e) {
                  if (context.mounted) showToast(context, 'Could not move ${g.name}', error: true);
                }
              },
            ),
          if (can(Act.create, 'member')) ...[
            const Divider(),
            ListTile(
              leading: const Icon(PhosphorIconsRegular.userCirclePlus),
              title: const Text('Convert to member'),
              subtitle: Text(g.email == null ? 'Needs an email on file — add one with Edit first' : 'Creates their member record'),
              enabled: g.email != null,
              onTap: () async {
                Navigator.pop(ctx);
                final ok = await confirmDialog(context,
                    title: 'Convert ${g.name} to a member?',
                    message: 'They join the roster as a Member and can log in with their phone number.',
                    confirmLabel: 'Convert');
                if (!ok) return;
                try {
                  await ref.read(apiProvider).http.post('guests/${g.id}/convert-to-member', body: {'roles': <String>[]});
                  ref.invalidate(guestsProvider);
                  ref.invalidate(guestProvider(g.id));
                  ref.invalidate(membersProvider);
                  if (context.mounted) showToast(context, '${g.name} joined as a member — they can log in now');
                } catch (e) {
                  if (context.mounted) showToast(context, errorText(e), error: true);
                }
              },
            ),
          ],
          const SizedBox(height: 8),
        ]),
      );
    },
  );
}
