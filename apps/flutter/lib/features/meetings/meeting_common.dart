import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../ui/icons.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/data.dart';
import '../../core/bd_time.dart';
import '../../core/config.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../domain/meeting_rules.dart';
import '../../ui/widgets.dart';

/// Public links that live on the web (guests don't install apps).
class MeetingLinks {
  const MeetingLinks._();
  static String agenda(Meeting m) => agendaFor(m.id);
  static String agendaFor(String meetingId) => '${AppConfig.webOrigin}/meetings/$meetingId/agenda';
  static String role(Meeting m, String role) =>
      '${AppConfig.webOrigin}/meetings/${m.id}/roles/$role?t=${Uri.encodeQueryComponent(m.shareToken)}';
  static String evaluate(Meeting m, String speakerId) =>
      '${AppConfig.webOrigin}/meetings/${m.id}/evaluate/$speakerId?t=${Uri.encodeQueryComponent(m.shareToken)}';
  static String vote(Meeting m) =>
      '${AppConfig.webOrigin}/meetings/${m.id}/vote?t=${Uri.encodeQueryComponent(m.shareToken)}';
  static String guestInvite(String token) => '${AppConfig.webOrigin}/guest-invite/$token';
}

Future<void> shareText(BuildContext context, String text, {String? subject}) async {
  final box = context.findRenderObject() as RenderBox?;
  await SharePlus.instance.share(ShareParams(
    text: text,
    subject: subject,
    sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size,
  ));
}

/// Builds and shares the announcement caption for [m].
Future<void> shareCaption(BuildContext context, WidgetRef ref, Meeting m) async {
  try {
    final club = await ref.read(clubProvider.future);
    final roles = await ref.read(meetingRolesProvider(m.id).future);
    final people = await ref.read(peopleProvider.future);
    String nameOf(String key) {
      final r = roles.where((r) => r.roleKey == key).firstOrNull;
      return people.name(membershipId: r?.membershipId, guestId: r?.guestId) ?? '';
    }

    final caption = buildMeetingCaption(
      m,
      club,
      generalEvaluator: nameOf('general-evaluator'),
      tableTopicsMaster: nameOf('table-topic-master'),
      toastmaster: nameOf('toastmaster'),
    );
    if (context.mounted) await shareText(context, caption);
  } catch (e) {
    if (context.mounted) showToast(context, 'Could not build the caption', error: true);
  }
}

/// Full-screen-ish QR sheet with Share and Copy (voting, evaluation, roles).
Future<void> showQrSheet(BuildContext context, {required String title, required String url, String? helper}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) {
      final t = Theme.of(ctx).textTheme;
      final c = AppColors.of(ctx);
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(title, style: t.titleLarge),
            if (helper != null) ...[
              const SizedBox(height: 4),
              Text(helper, style: t.bodySmall, textAlign: TextAlign.center),
            ],
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: QrImageView(data: url, size: 240, backgroundColor: Colors.white),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(10)),
              child: Text(url, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.inkSoft)),
            ),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => copyText(ctx, url, 'Link copied'),
                  icon: const Icon(PhosphorIconsRegular.copy, size: 18),
                  label: const Text('Copy'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => shareText(ctx, url),
                  icon: const Icon(PhosphorIconsRegular.shareNetwork, size: 18),
                  label: const Text('Share'),
                ),
              ),
            ]),
          ]),
        ),
      );
    },
  );
}

/// List card for a meeting: banner strip with number + status, then theme,
/// date/time, and Share caption.
class MeetingCard extends ConsumerWidget {
  const MeetingCard({super.key, required this.meeting, required this.onTap, this.bannerColor});
  final Meeting meeting;
  final VoidCallback onTap;
  final Color? bannerColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 6),
      child: Material(
        color: c.canvas,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: c.line)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                color: bannerColor,
                gradient: bannerColor == null
                    ? LinearGradient(colors: [c.heroStart, c.heroEnd], begin: Alignment.topLeft, end: Alignment.bottomRight)
                    : null,
              ),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('MEETING', style: t.labelSmall?.copyWith(color: Colors.white70, letterSpacing: 1.6)),
                    Text('#${meeting.meetingNumber}',
                        style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700, height: 1.1)),
                  ]),
                ),
                MeetingStatusPill(meeting: meeting, onDark: true),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('THEME', style: t.labelSmall),
                const SizedBox(height: 2),
                Text(meeting.displayTheme, style: t.titleLarge?.copyWith(fontSize: 18)),
                const SizedBox(height: 8),
                Row(children: [
                  Icon(PhosphorIconsRegular.calendarBlank, size: 16, color: c.inkSoft),
                  const SizedBox(width: 6),
                  Text(BdTime.shortDate(meeting.dateTime), style: t.bodyMedium?.copyWith(color: c.inkSoft)),
                  const SizedBox(width: 14),
                  Icon(PhosphorIconsRegular.clock, size: 16, color: c.inkSoft),
                  const SizedBox(width: 6),
                  Text(BdTime.time(meeting.dateTime), style: t.bodyMedium?.copyWith(color: c.inkSoft)),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Share caption',
                    icon: Icon(PhosphorIconsRegular.shareNetwork, size: 20, color: c.inkSoft),
                    onPressed: () => shareCaption(context, ref, meeting),
                  ),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class MeetingStatusPill extends StatelessWidget {
  const MeetingStatusPill({super.key, required this.meeting, this.onDark = false});
  final Meeting meeting;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    if (meeting.isPublished) {
      return Pill('PUBLISHED',
          icon: PhosphorIconsFill.checkCircle,
          color: onDark ? Colors.white : c.success,
          background: onDark ? Colors.white.withValues(alpha: 0.16) : c.successSoft);
    }
    return Pill('DRAFT', icon: PhosphorIconsFill.penNib, color: const Color(0xFF9E6C00), background: const Color(0xFFFFF4CC));
  }
}

/// Parses a club banner colour ("#1F3A5F") if one is set.
Color? parseHexColor(String? hex) {
  if (hex == null) return null;
  final h = hex.replaceAll('#', '');
  if (h.length != 6) return null;
  final v = int.tryParse(h, radix: 16);
  return v == null ? null : Color(0xFF000000 | v);
}

// ───────────────────────── Assignee picker ─────────────────────────

/// Full-height searchable picker of members and guests. Returns the chosen
/// assignee, or [AssigneeResult.cleared] when "Unassign" is tapped.
class AssigneeResult {
  const AssigneeResult(this.assignee);
  const AssigneeResult.cleared() : assignee = null;
  final Assignee? assignee;
}

Future<AssigneeResult?> pickAssignee(
  BuildContext context, {
  required String title,
  Assignee? current,
  bool allowGuests = true,
  bool allowClear = true,
}) {
  return showModalBottomSheet<AssigneeResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => _AssigneePicker(title: title, current: current, allowGuests: allowGuests, allowClear: allowClear),
  );
}

class _AssigneePicker extends ConsumerStatefulWidget {
  const _AssigneePicker({required this.title, this.current, required this.allowGuests, required this.allowClear});
  final String title;
  final Assignee? current;
  final bool allowGuests;
  final bool allowClear;
  @override
  ConsumerState<_AssigneePicker> createState() => _AssigneePickerState();
}

class _AssigneePickerState extends ConsumerState<_AssigneePicker> {
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final people = ref.watch(peopleProvider);
    final q = _q.text.trim().toLowerCase();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (ctx, scroll) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Row(children: [
            Expanded(child: Text(widget.title, style: Theme.of(context).textTheme.titleLarge)),
            if (widget.allowClear && widget.current != null)
              TextButton(
                onPressed: () => Navigator.pop(context, const AssigneeResult.cleared()),
                style: TextButton.styleFrom(foregroundColor: c.danger),
                child: const Text('Unassign'),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            controller: _q,
            autofocus: false,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Search members or guests',
              prefixIcon: Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: AsyncBody<People>(
            value: people,
            onRetry: () => ref.invalidate(peopleProvider),
            builder: (p) {
              final members = p.members.where((m) => m.isActive && (q.isEmpty || m.name.toLowerCase().contains(q))).toList();
              final guests = widget.allowGuests
                  ? p.guests.where((g) => q.isEmpty || g.name.toLowerCase().contains(q)).toList()
                  : <Guest>[];
              return ListView(controller: scroll, children: [
                if (members.isNotEmpty) const SectionLabel('Members', padding: EdgeInsets.fromLTRB(20, 8, 20, 4)),
                for (final m in members)
                  RowTile(
                    leading: Avatar(name: m.name, url: m.avatarUrl, size: 36),
                    title: m.name,
                    subtitle: m.rolesLabel,
                    trailing: widget.current?.id == m.id && widget.current?.isGuest == false
                        ? Icon(PhosphorIconsFill.checkCircle, color: c.success)
                        : null,
                    onTap: () => Navigator.pop(context, AssigneeResult(Assignee.member(m.id, m.name))),
                  ),
                if (guests.isNotEmpty) const SectionLabel('Guests', padding: EdgeInsets.fromLTRB(20, 16, 20, 4)),
                for (final g in guests)
                  RowTile(
                    leading: Avatar(name: g.name, url: g.avatarUrl, size: 36),
                    title: '${g.name} (Guest)',
                    subtitle: GuestStage.fromId(g.stage).label,
                    trailing: widget.current?.id == g.id && widget.current?.isGuest == true
                        ? Icon(PhosphorIconsFill.checkCircle, color: c.success)
                        : null,
                    onTap: () => Navigator.pop(context, AssigneeResult(Assignee.guest(g.id, g.name))),
                  ),
                if (members.isEmpty && guests.isEmpty)
                  const EmptyState(icon: PhosphorIconsRegular.magnifyingGlass, title: 'No one matches'),
                const SizedBox(height: 24),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}

/// Light haptic for taps that change data.
void tapHaptic() => HapticFeedback.lightImpact();
