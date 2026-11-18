import 'package:flutter/material.dart';

/// The app-wide snackbar host, for code with no `BuildContext` — push
/// handlers and the notification opener, which can run after the screen
/// that started them is gone.
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

void showAppToast(String message, {SnackBarAction? action}) {
  final m = scaffoldMessengerKey.currentState;
  if (m == null) return;
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(content: Text(message), action: action));
}
