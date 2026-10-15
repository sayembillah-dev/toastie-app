import 'package:flutter/material.dart';

/// Design tokens (PRD §4.1). Monochrome ink base, navy hero surfaces, mint
/// as the single "this is you / success" accent. Every colour is defined for
/// light and dark; widgets read them through [AppColors.of].
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.ink,
    required this.inkSoft,
    required this.inkMuted,
    required this.canvas,
    required this.surface,
    required this.fill,
    required this.fillStrong,
    required this.line,
    required this.heroStart,
    required this.heroEnd,
    required this.mint,
    required this.mintSoft,
    required this.danger,
    required this.dangerSoft,
    required this.warning,
    required this.warningSoft,
    required this.success,
    required this.successSoft,
  });

  final Color ink;
  final Color inkSoft;
  final Color inkMuted;
  final Color canvas;
  final Color surface;
  final Color fill;
  final Color fillStrong;
  final Color line;
  final Color heroStart;
  final Color heroEnd;
  final Color mint;
  final Color mintSoft;
  final Color danger;
  final Color dangerSoft;
  final Color warning;
  final Color warningSoft;
  final Color success;
  final Color successSoft;

  static const light = AppColors(
    ink: Color(0xFF1C1C1C),
    inkSoft: Color(0xFF5C5C5C),
    inkMuted: Color(0xFF8A8A8A),
    canvas: Color(0xFFFFFFFF),
    surface: Color(0xFFFAFAFA),
    fill: Color(0xFFF2F2F2),
    fillStrong: Color(0xFFEBEBEB),
    line: Color(0xFFEDEDED),
    heroStart: Color(0xFF2B3A55),
    heroEnd: Color(0xFF111A2E),
    mint: Color(0xFF5EE0B8),
    mintSoft: Color(0x2E5EE0B8),
    danger: Color(0xFFCE2C31),
    dangerSoft: Color(0xFFFFF1F2),
    warning: Color(0xFF9E6C00),
    warningSoft: Color(0xFFFFF4CC),
    success: Color(0xFF218358),
    successSoft: Color(0xFFE6F6EE),
  );

  static const dark = AppColors(
    ink: Color(0xFFF5F5F5),
    inkSoft: Color(0xFFB0B4BA),
    inkMuted: Color(0xFF7C8088),
    canvas: Color(0xFF0B0B0C),
    surface: Color(0xFF161618),
    fill: Color(0xFF212225),
    fillStrong: Color(0xFF2A2C30),
    line: Color(0xFF2E3135),
    heroStart: Color(0xFF26334D),
    heroEnd: Color(0xFF0D1424),
    mint: Color(0xFF5EE0B8),
    mintSoft: Color(0x335EE0B8),
    danger: Color(0xFFFF9592),
    dangerSoft: Color(0xFF3B1517),
    warning: Color(0xFFFFC53D),
    warningSoft: Color(0xFF3A2C05),
    success: Color(0xFF3DD68C),
    successSoft: Color(0xFF0F2E20),
  );

  static AppColors of(BuildContext context) =>
      Theme.of(context).extension<AppColors>() ?? light;

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(AppColors? other, double t) => t < 0.5 ? this : (other ?? this);
}

class Space {
  const Space._();
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double gutter = 16;
}

class Radii {
  const Radii._();
  static const double card = 12;
  static const double sheet = 16;
  static const double control = 10;
}

/// Guest pipeline stages and their colours, mirrored from the web.
enum GuestStage {
  newGuest('new', 'New', Color(0xFF64748B), Color(0xFFF1F5F9)),
  contacted('contacted', 'Contacted', Color(0xFFB45309), Color(0xFFFEF3C7)),
  interested('interested', 'Interested', Color(0xFF0369A1), Color(0xFFE0F2FE)),
  joinedMeetings('joined-meetings', 'Joined Meeting(s)', Color(0xFF6D28D9), Color(0xFFEDE9FE)),
  joinedClub('joined-club', 'Joined Club', Color(0xFF047857), Color(0xFFD1FAE5)),
  notInterested('not-interested', 'Not Interested', Color(0xFF8A8A8A), Color(0xFFF2F2F2));

  const GuestStage(this.id, this.label, this.accent, this.soft);
  final String id;
  final String label;
  final Color accent;
  final Color soft;

  static GuestStage fromId(String? id) =>
      GuestStage.values.firstWhere((s) => s.id == id, orElse: () => GuestStage.newGuest);
}
