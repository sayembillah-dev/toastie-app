import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// Saves screenshots taken by integration tests to build/screenshots/.
Future<void> main() => integrationDriver(
      onScreenshot: (name, bytes, [args]) async {
        final f = File('build/screenshots/$name.png');
        await f.parent.create(recursive: true);
        await f.writeAsBytes(bytes);
        return true;
      },
    );
