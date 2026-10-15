import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/features/live/light_alert.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('SOS lasts 5–7 seconds: · · · — — — · · ·', () {
    expect(LightAlert.totalMs, inInclusiveRange(5000, 7000));
    final on = [for (var i = 0; i < LightAlert.sos.length; i += 2) LightAlert.sos[i]];
    expect(on, [250, 250, 250, 750, 750, 750, 250, 250, 250]);
  });

  test('flashes in step with the pattern, then ends on its own', () {
    fakeAsync((async) {
      final alert = LightAlert();
      final seen = <bool>[];
      alert.addListener(() => seen.add(alert.flashOn));
      alert.play();
      async.flushMicrotasks();
      expect(alert.active, isTrue);
      expect(alert.flashOn, isTrue);

      async.elapse(const Duration(milliseconds: 250));
      expect(alert.flashOn, isFalse); // first gap

      async.elapse(Duration(milliseconds: LightAlert.totalMs));
      expect(alert.active, isFalse);
      expect(alert.flashOn, isFalse);
      // 17 pulses/gaps plus the final "off".
      expect(seen.where((on) => on).length, 9);
    });
  });

  test('stop() ends it immediately and a stale timer never revives it', () {
    fakeAsync((async) {
      final alert = LightAlert()..play();
      async.elapse(const Duration(milliseconds: 1000));
      alert.stop();
      expect(alert.active, isFalse);
      async.elapse(const Duration(seconds: 10));
      expect(alert.active, isFalse);
    });
  });
}
