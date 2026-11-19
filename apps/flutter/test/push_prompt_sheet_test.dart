import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/core/theme/app_theme.dart';
import 'package:toastie/features/notifications/push_permission_prompt.dart';

/// The notifications prompt must fit, without overflow, on every screen we
/// ship to: small and large phones, landscape, tablets, and large font sizes.
void main() {
  const sizes = <String, Size>{
    'iPhone SE (1st gen)': Size(320, 568),
    'small Android': Size(360, 640),
    'iPhone 15': Size(393, 852),
    'large Android': Size(412, 915),
    'phone landscape': Size(852, 393),
    'iPad portrait': Size(820, 1180),
    'iPad landscape': Size(1180, 820),
  };
  const scales = [1.0, 1.3, 2.0];

  for (final entry in sizes.entries) {
    for (final scale in scales) {
      testWidgets('${entry.key} @ ${scale}x text', (tester) async {
        tester.view.physicalSize = entry.value * 3;
        tester.view.devicePixelRatio = 3;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        bool? result;
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light(),
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: () async => result = await showPushPromptSheet(context),
                    child: const Text('open'),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);

        await tester.tap(find.text('Not now'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text("You'll miss"), findsOneWidget);

        // Both buttons stay on screen and tappable.
        final skip = find.text('Skip');
        expect(tester.getRect(find.text('Turn on')).bottom, lessThanOrEqualTo(entry.value.height));
        expect(tester.getRect(skip).bottom, lessThanOrEqualTo(entry.value.height));
        expect(tester.getRect(find.widgetWithText(FilledButton, 'Turn on')).width, lessThanOrEqualTo(560));
        await tester.tap(skip);
        await tester.pumpAndSettle();
        expect(result, isFalse);
      });
    }
  }
}
