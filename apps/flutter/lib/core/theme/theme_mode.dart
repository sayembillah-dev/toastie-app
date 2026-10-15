import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _key = 'theme_mode';

/// Light unless the user picks otherwise in Me → Appearance.
const defaultThemeMode = ThemeMode.light;

/// Read before the first frame (see main.dart) so a dark-mode user never sees
/// a light flash.
Future<ThemeMode> loadThemeMode() async {
  try {
    final p = await SharedPreferences.getInstance();
    return ThemeMode.values.asNameMap()[p.getString(_key)] ?? defaultThemeMode;
  } catch (_) {
    return defaultThemeMode;
  }
}

final initialThemeModeProvider = Provider<ThemeMode>((ref) => defaultThemeMode);

final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => ref.watch(initialThemeModeProvider);

  Future<void> set(ThemeMode mode) async {
    state = mode;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_key, mode.name);
    } catch (_) {
      // Still applies for this session.
    }
  }
}

extension ThemeModeLabel on ThemeMode {
  String get label => switch (this) {
        ThemeMode.light => 'Light',
        ThemeMode.dark => 'Dark',
        ThemeMode.system => 'Match phone setting',
      };
}
