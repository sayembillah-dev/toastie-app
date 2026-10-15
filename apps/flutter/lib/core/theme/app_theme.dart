import 'package:flutter/material.dart';

import 'tokens.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData light() => _build(AppColors.light, Brightness.light);
  static ThemeData dark() => _build(AppColors.dark, Brightness.dark);

  static ThemeData _build(AppColors c, Brightness b) {
    final scheme = ColorScheme(
      brightness: b,
      primary: c.ink,
      onPrimary: c.canvas,
      secondary: c.mint,
      onSecondary: const Color(0xFF0B2A20),
      error: c.danger,
      onError: Colors.white,
      surface: c.canvas,
      onSurface: c.ink,
      surfaceContainerLowest: c.canvas,
      surfaceContainerLow: c.surface,
      surfaceContainer: c.surface,
      surfaceContainerHigh: c.fill,
      surfaceContainerHighest: c.fillStrong,
      onSurfaceVariant: c.inkSoft,
      outline: c.line,
      outlineVariant: c.line,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: b,
      colorScheme: scheme,
      scaffoldBackgroundColor: c.surface,
      extensions: [c],
      splashFactory: InkSparkle.splashFactory,
    );

    final text = base.textTheme.apply(bodyColor: c.ink, displayColor: c.ink).copyWith(
          headlineLarge: base.textTheme.headlineLarge?.copyWith(
              fontSize: 32, height: 1.2, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: c.ink),
          headlineMedium: base.textTheme.headlineMedium?.copyWith(
              fontSize: 26, height: 1.2, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: c.ink),
          titleLarge: base.textTheme.titleLarge?.copyWith(
              fontSize: 20, height: 1.3, fontWeight: FontWeight.w600, color: c.ink),
          titleMedium: base.textTheme.titleMedium?.copyWith(
              fontSize: 16, height: 1.35, fontWeight: FontWeight.w600, color: c.ink),
          bodyLarge: base.textTheme.bodyLarge?.copyWith(fontSize: 16, height: 1.5, color: c.ink),
          bodyMedium: base.textTheme.bodyMedium?.copyWith(fontSize: 15, height: 1.45, color: c.ink),
          bodySmall: base.textTheme.bodySmall?.copyWith(fontSize: 13, height: 1.4, color: c.inkSoft),
          labelSmall: base.textTheme.labelSmall?.copyWith(
              fontSize: 11.5, letterSpacing: 0.8, fontWeight: FontWeight.w600, color: c.inkMuted),
        );

    final fieldBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(Radii.control),
      borderSide: BorderSide(color: c.line),
    );

    return base.copyWith(
      textTheme: text,
      appBarTheme: AppBarTheme(
        backgroundColor: c.surface,
        foregroundColor: c.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: text.titleMedium?.copyWith(fontSize: 17),
      ),
      cardTheme: CardThemeData(
        color: c.canvas,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.card),
          side: BorderSide(color: c.line),
        ),
      ),
      dividerTheme: DividerThemeData(color: c.line, space: 1, thickness: 1),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.canvas,
        surfaceTintColor: Colors.transparent,
        indicatorColor: c.fill,
        height: 64,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => TextStyle(
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
            color: s.contains(WidgetState.selected) ? c.ink : c.inkMuted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(color: s.contains(WidgetState.selected) ? c.ink : c.inkMuted, size: 24),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.canvas,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: fieldBorder,
        enabledBorder: fieldBorder,
        focusedBorder: fieldBorder.copyWith(borderSide: BorderSide(color: c.ink, width: 1.4)),
        errorBorder: fieldBorder.copyWith(borderSide: BorderSide(color: c.danger)),
        focusedErrorBorder: fieldBorder.copyWith(borderSide: BorderSide(color: c.danger, width: 1.4)),
        hintStyle: TextStyle(color: c.inkMuted),
        labelStyle: TextStyle(color: c.inkSoft),
        helperMaxLines: 3,
        errorMaxLines: 3,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.ink,
          foregroundColor: c.canvas,
          disabledBackgroundColor: c.fillStrong,
          disabledForegroundColor: c.inkMuted,
          minimumSize: const Size(48, 50),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.control)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.ink,
          minimumSize: const Size(48, 44),
          side: BorderSide(color: c.line),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.control)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.ink,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: c.ink,
        foregroundColor: c.canvas,
        elevation: 2,
        shape: const CircleBorder(),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.canvas,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: c.fillStrong,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: c.ink,
        contentTextStyle: TextStyle(color: c.canvas, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.fill,
        selectedColor: c.ink,
        side: BorderSide.none,
        labelStyle: TextStyle(color: c.ink, fontSize: 13, fontWeight: FontWeight.w500),
        secondaryLabelStyle: TextStyle(color: c.canvas, fontSize: 13, fontWeight: FontWeight.w600),
        shape: const StadiumBorder(),
        showCheckmark: false,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          visualDensity: VisualDensity.compact,
          side: WidgetStatePropertyAll(BorderSide(color: c.line)),
          backgroundColor: WidgetStateProperty.resolveWith(
              (s) => s.contains(WidgetState.selected) ? c.ink : c.canvas),
          foregroundColor: WidgetStateProperty.resolveWith(
              (s) => s.contains(WidgetState.selected) ? c.canvas : c.ink),
        ),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: c.inkSoft,
        titleTextStyle: text.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
        subtitleTextStyle: text.bodySmall,
        contentPadding: const EdgeInsets.symmetric(horizontal: Space.lg),
      ),
      switchTheme: SwitchThemeData(
        trackColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? c.success : c.fillStrong),
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: c.ink),
    );
  }
}
