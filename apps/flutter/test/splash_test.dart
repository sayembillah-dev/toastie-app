import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toastie/app/splash.dart';

Widget _app() => const MaterialApp(home: IntroSplash(child: Scaffold(body: Center(child: Text('APP')))));

void main() {
  testWidgets('plays over the app, then gets out of the way', (tester) async {
    await tester.pumpWidget(_app());
    expect(find.text('Open Floor'), findsOneWidget);
    expect(find.text('APP'), findsOneWidget); // already built underneath

    await tester.pump(const Duration(milliseconds: 1000));
    expect(find.text('Open Floor'), findsOneWidget);

    await tester.pumpAndSettle();
    expect(find.text('Open Floor'), findsNothing);
    expect(find.text('APP'), findsOneWidget);
  });

  testWidgets('a tap skips it', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tapAt(const Offset(10, 10));
    // Frame by frame: the 300 ms skip starts on the next frame. 200 + 800 ms
    // is still well short of the 1.85 s intro, so this proves the skip.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('Open Floor'), findsNothing);
  });

  testWidgets('reduced motion goes straight to a short fade', (tester) async {
    await tester.pumpWidget(const MediaQuery(
      data: MediaQueryData(disableAnimations: true),
      child: MaterialApp(home: IntroSplash(child: Text('APP'))),
    ));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
    expect(find.text('Open Floor'), findsNothing);
  });

  // Visual check: SPLASH_FRAMES_DIR=/some/dir flutter test test/splash_test.dart
  final dir = Platform.environment['SPLASH_FRAMES_DIR'];
  testWidgets('dump frames', skip: dir == null, (tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(key: key, child: _app()));
    await tester.runAsync(() async {
      final el = tester.element(find.byType(Image));
      await precacheImage(const AssetImage('assets/splash/splash_logo.png'), el);
    });
    var at = 0;
    for (final ms in [0, 250, 500, 800, 1200, 1600]) {
      await tester.pump(Duration(milliseconds: ms - at));
      at = ms;
      await tester.runAsync(() async {
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final img = await boundary.toImage(pixelRatio: 1);
        final png = await img.toByteData(format: ui.ImageByteFormat.png);
        File('$dir/splash_$ms.png').writeAsBytesSync(png!.buffer.asUint8List());
      });
    }
  });
}
