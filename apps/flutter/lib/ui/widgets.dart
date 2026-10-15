import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'icons.dart';

import '../core/api/api_client.dart';
import '../core/bd_time.dart';
import '../core/theme/tokens.dart';

// ───────────────────────── Feedback ─────────────────────────

void showToast(BuildContext context, String message, {bool error = false}) {
  final m = ScaffoldMessenger.maybeOf(context);
  if (m == null) return;
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(
    content: Text(message),
    backgroundColor: error ? AppColors.of(context).danger : null,
  ));
}

String errorText(Object e) => e is ApiError ? e.message : 'Something went wrong. Please try again.';

Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  String? message,
  String confirmLabel = 'Confirm',
  bool destructive = false,
}) async {
  final c = AppColors.of(context);
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: c.canvas,
      surfaceTintColor: Colors.transparent,
      title: Text(title, style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontSize: 18)),
      content: message == null ? null : Text(message, style: Theme.of(ctx).textTheme.bodyMedium),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: destructive ? TextButton.styleFrom(foregroundColor: c.danger) : null,
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok ?? false;
}

Future<void> copyText(BuildContext context, String text, String toast) async {
  await Clipboard.setData(ClipboardData(text: text));
  if (context.mounted) showToast(context, toast);
}

// ───────────────────────── Sheets ─────────────────────────

class SheetAction {
  const SheetAction({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.onTap,
    this.destructive = false,
  });
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final bool destructive;
}

/// Bottom action sheet — the mobile replacement for "…" dropdown menus.
Future<void> showActionSheet(BuildContext context, {String? title, required List<SheetAction> actions}) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (ctx) {
      final c = AppColors.of(ctx);
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (title != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                  child: Text(title, style: Theme.of(ctx).textTheme.titleMedium),
                ),
              for (final a in actions)
                InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    Navigator.pop(ctx);
                    a.onTap();
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: a.destructive ? c.dangerSoft : c.fill,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(a.icon, size: 19, color: a.destructive ? c.danger : c.inkSoft),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(a.label,
                              style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w500,
                                  color: a.destructive ? c.danger : c.ink)),
                          if (a.subtitle != null)
                            Text(a.subtitle!, style: TextStyle(fontSize: 12.5, color: c.inkMuted)),
                        ]),
                      ),
                    ]),
                  ),
                ),
            ],
          ),
        ),
      );
    },
  );
}

/// Full-height form sheet with a sticky primary button above the keyboard.
Future<T?> showFormSheet<T>(BuildContext context, {required Widget Function(BuildContext) builder}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: builder(ctx),
    ),
  );
}

class SheetScaffold extends StatelessWidget {
  const SheetScaffold({
    super.key,
    required this.title,
    required this.children,
    this.primaryLabel,
    this.onPrimary,
    this.busy = false,
    this.subtitle,
  });
  final String title;
  final String? subtitle;
  final List<Widget> children;
  final String? primaryLabel;
  final VoidCallback? onPrimary;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
          child: Text(title, style: t.titleLarge),
        ),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
            child: Text(subtitle!, style: t.bodySmall),
          ),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
          ),
        ),
        if (primaryLabel != null)
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
              child: FilledButton(
                onPressed: busy ? null : onPrimary,
                child: busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : Text(primaryLabel!),
              ),
            ),
          ),
      ],
    );
  }
}

// ───────────────────────── Building blocks ─────────────────────────

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing, this.padding});
  final String text;
  final Widget? trailing;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? const EdgeInsets.fromLTRB(Space.gutter, Space.xl, Space.gutter, Space.sm),
      child: Row(children: [
        Expanded(child: Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall)),
        ?trailing,
      ]),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(Space.lg), this.margin});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final body = Padding(padding: padding, child: child);
    return Padding(
      padding: margin ?? const EdgeInsets.symmetric(horizontal: Space.gutter),
      child: Material(
        color: c.canvas,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.card),
          side: BorderSide(color: c.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: onTap == null ? body : InkWell(onTap: onTap, child: body),
      ),
    );
  }
}

/// Avatar with photo or initials on a colour derived from the name.
class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.url, this.size = 40});
  final String name;
  final String? url;
  final double size;

  static const _palette = [
    (Color(0xFFDBEAFE), Color(0xFF1D4ED8)),
    (Color(0xFFDCFCE7), Color(0xFF15803D)),
    (Color(0xFFFEF3C7), Color(0xFFB45309)),
    (Color(0xFFEDE9FE), Color(0xFF6D28D9)),
    (Color(0xFFFCE7F3), Color(0xFFBE185D)),
    (Color(0xFFCFFAFE), Color(0xFF0E7490)),
  ];

  @override
  Widget build(BuildContext context) {
    final pair = _palette[name.codeUnits.fold<int>(0, (a, b) => a + b) % _palette.length];
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: pair.$1, shape: BoxShape.circle),
      child: Text(
        initials(name),
        style: TextStyle(color: pair.$2, fontWeight: FontWeight.w600, fontSize: size * 0.36),
      ),
    );
    if (url == null || url!.isEmpty) return fallback;
    return ClipOval(
      child: Image.network(
        url!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.color, this.background, this.icon});
  final String label;
  final Color? color;
  final Color? background;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final fg = color ?? c.inkSoft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: background ?? c.fill, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 12, color: fg), const SizedBox(width: 4)],
        Text(label, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
      ]),
    );
  }
}

/// Circular progress ring with an icon in the middle (meeting hub cards).
class ProgressRing extends StatelessWidget {
  const ProgressRing({super.key, required this.icon, this.value, this.size = 40});
  final IconData icon;
  final double? value; // null = bare track
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final done = value != null && value! >= 0.999;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _RingPainter(value: value, track: c.fillStrong, color: done ? c.success : c.ink),
        child: Center(child: Icon(icon, size: size * 0.42, color: done ? c.success : c.inkSoft)),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.value, required this.track, required this.color});
  final double? value;
  final Color track;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 2.6;
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    canvas.drawArc(r, 0, math.pi * 2, false,
        Paint()..color = track..style = PaintingStyle.stroke..strokeWidth = stroke);
    final v = value;
    if (v != null && v > 0) {
      canvas.drawArc(r, -math.pi / 2, math.pi * 2 * v.clamp(0, 1), false,
          Paint()
            ..color = color
            ..style = PaintingStyle.stroke
            ..strokeWidth = stroke
            ..strokeCap = StrokeCap.round);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value || old.color != color;
}

// ───────────────────────── States ─────────────────────────

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action});
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(14)),
          child: Icon(icon, color: c.inkSoft),
        ),
        const SizedBox(height: 14),
        Text(title, style: t.titleMedium, textAlign: TextAlign.center),
        if (message != null) ...[
          const SizedBox(height: 6),
          Text(message!, style: t.bodySmall, textAlign: TextAlign.center),
        ],
        if (action != null) ...[const SizedBox(height: 16), action!],
      ]),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, this.onRetry, this.title = 'Could not load this'});
  final Object error;
  final VoidCallback? onRetry;
  final String title;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: PhosphorIconsRegular.warningCircle,
      title: title,
      message: errorText(error),
      action: onRetry == null ? null : OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
    );
  }
}

class SkeletonBox extends StatefulWidget {
  const SkeletonBox({super.key, this.height = 72, this.radius = Radii.card, this.margin});
  final double height;
  final double radius;
  final EdgeInsetsGeometry? margin;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _a = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _a.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: widget.margin ?? const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 6),
      child: FadeTransition(
        opacity: Tween(begin: 0.55, end: 1.0).animate(_a),
        child: Container(
          height: widget.height,
          decoration: BoxDecoration(color: c.fill, borderRadius: BorderRadius.circular(widget.radius)),
        ),
      ),
    );
  }
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 5, this.height = 72});
  final int count;
  final double height;
  @override
  Widget build(BuildContext context) => Column(
        children: [const SizedBox(height: 8), for (var i = 0; i < count; i++) SkeletonBox(height: height)],
      );
}

/// Renders an [AsyncValue] with the standard skeleton / error / data states.
/// Keeps showing previous data while a refresh is in flight.
class AsyncBody<T> extends StatelessWidget {
  const AsyncBody({
    super.key,
    required this.value,
    required this.builder,
    this.onRetry,
    this.loading,
    this.errorTitle = 'Could not load this',
  });
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;
  final Widget? loading;
  final String errorTitle;

  @override
  Widget build(BuildContext context) {
    if (value.hasValue) return builder(value.requireValue);
    if (value.hasError) {
      return ErrorState(error: value.error!, onRetry: onRetry, title: errorTitle);
    }
    return loading ?? const SkeletonList();
  }
}

/// "Offline · showing saved data" strip, shown while GETs are served from cache.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key, required this.offline});
  final ValueNotifier<bool> offline;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ValueListenableBuilder<bool>(
      valueListenable: offline,
      builder: (context, isOffline, _) {
        if (!isOffline) return const SizedBox.shrink();
        final c = AppColors.of(context);
        return Material(
          color: c.warningSoft,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(children: [
                Icon(PhosphorIconsRegular.wifiSlash, size: 16, color: c.warning),
                const SizedBox(width: 8),
                Text('Offline · showing saved data', style: TextStyle(color: c.warning, fontSize: 13, fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        );
      },
    );
  }
}

/// A list row: leading widget, title, subtitle, trailing.
class RowTile extends StatelessWidget {
  const RowTile({
    super.key,
    this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.titleStyle,
    this.dense = false,
  });
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final TextStyle? titleStyle;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: Space.lg, vertical: dense ? 9 : 12),
        child: Row(children: [
          if (leading != null) ...[leading!, const SizedBox(width: 12)],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: titleStyle ?? TextStyle(fontSize: 15.5, fontWeight: FontWeight.w500, color: c.ink)),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: c.inkMuted)),
              ],
            ]),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ]),
      ),
    );
  }
}

class Chevron extends StatelessWidget {
  const Chevron({super.key});
  @override
  Widget build(BuildContext context) =>
      Icon(PhosphorIconsRegular.caretRight, size: 16, color: AppColors.of(context).inkMuted);
}

/// A grouped card of rows separated by hairlines.
class GroupCard extends StatelessWidget {
  const GroupCard({super.key, required this.children, this.margin});
  final List<Widget> children;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return AppCard(
      padding: EdgeInsets.zero,
      margin: margin,
      child: Column(children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) Divider(height: 1, indent: Space.lg, color: c.line),
          children[i],
        ],
      ]),
    );
  }
}

/// Labelled form field wrapper ("Full name (optional)").
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.label, {super.key, this.optional = false, this.required = false});
  final String label;
  final bool optional;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, top: 14),
      child: Text.rich(TextSpan(children: [
        TextSpan(text: label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.ink)),
        if (optional) TextSpan(text: '  (optional)', style: TextStyle(fontSize: 13, color: c.inkMuted)),
        if (required) TextSpan(text: '  · Required', style: TextStyle(fontSize: 13, color: c.inkMuted)),
      ])),
    );
  }
}
