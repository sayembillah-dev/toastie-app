import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:vibration/vibration.dart';

/// The attention signal when a timing light changes: Morse SOS
/// (· · · — — — · · ·) played on the vibration motor and as a screen flash
/// in lock step, with the screen at full brightness, ≈6.75 s in all — long
/// enough that a Timer looking at the speaker still notices.
class LightAlert extends ChangeNotifier {
  static const _dot = 250;
  static const _dash = 750;
  static const _gap = 250; // between signals within a letter
  static const _letterGap = 750;

  /// Alternating on/off durations in ms, starting with "on".
  static const List<int> sos = [
    _dot, _gap, _dot, _gap, _dot, _letterGap, //
    _dash, _gap, _dash, _gap, _dash, _letterGap,
    _dot, _gap, _dot, _gap, _dot,
  ];

  static int get totalMs => sos.fold(0, (a, b) => a + b);

  /// True during an "on" pulse — the screen shows the light colour; between
  /// pulses it goes dark.
  bool get flashOn => _flashOn;
  bool get active => _active;

  bool _flashOn = false;
  bool _active = false;
  Timer? _step;
  int _generation = 0;

  Future<void> play() async {
    stop();
    final gen = ++_generation;
    _active = true;
    unawaited(_lightUp());
    unawaited(_vibrate());
    var i = 0;
    void next() {
      if (gen != _generation) return;
      if (i >= sos.length) {
        stop();
        return;
      }
      _flashOn = i.isEven;
      notifyListeners();
      _step = Timer(Duration(milliseconds: sos[i++]), next);
    }

    next();
  }

  /// Ends the signal early (tap on the screen, timer stopped, view closed).
  void stop() {
    _generation++;
    _step?.cancel();
    _step = null;
    if (_active) {
      _active = false;
      _flashOn = false;
      notifyListeners();
      unawaited(_quiet());
    }
  }

  Future<void> _vibrate() async {
    try {
      if (!await Vibration.hasVibrator()) return;
      // The plugin's pattern is [wait, on, off, on, …].
      await Vibration.vibrate(pattern: [0, ...sos]);
    } catch (_) {
      // No motor or plugin unavailable — the flash still runs.
    }
  }

  Future<void> _lightUp() async {
    try {
      await ScreenBrightness.instance.setApplicationScreenBrightness(1);
    } catch (_) {}
  }

  Future<void> _quiet() async {
    try {
      await Vibration.cancel();
    } catch (_) {}
    try {
      await ScreenBrightness.instance.resetApplicationScreenBrightness();
    } catch (_) {}
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
