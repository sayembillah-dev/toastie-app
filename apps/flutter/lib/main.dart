import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app/email_gate.dart';
import 'app/messenger.dart';
import 'app/push.dart';
import 'app/router.dart';
import 'app/splash.dart';
import 'app/session.dart';
import 'core/api/api_client.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode.dart';
import 'data/toastie_api.dart';
import 'features/onboarding/onboarding_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en_GB');
  await initializeDateFormatting('en_US');
  // Portrait everywhere; the Timer's running view opts into landscape itself.
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  // Resolve the session while the native splash is still up, so the first
  // frame is already the right screen.
  final tokens = TokenStore();
  final client = ApiClient(tokens);
  final initial = await AuthController.bootstrap(tokens, ToastieApi(client));
  final themeMode = await loadThemeMode();
  final onboardingSeen = await loadOnboardingSeen();

  final push = await PushNotifications.create();

  // A plain container (not ProviderScope) so push handlers, which run with
  // no widget, can read and navigate through it.
  final container = ProviderContainer(
    overrides: [
      pushProvider.overrideWithValue(push),
      tokenStoreProvider.overrideWithValue(tokens),
      apiClientProvider.overrideWithValue(client),
      initialAuthProvider.overrideWithValue(initial),
      initialThemeModeProvider.overrideWithValue(themeMode),
      initialOnboardingSeenProvider.overrideWithValue(onboardingSeen),
    ],
    // API errors are shown with a Retry button; never retry silently.
    retry: (_, _) => null,
  );

  runApp(UncontrolledProviderScope(container: container, child: const ToastieApp()));
  // After the first frame, so a tap that launched the app can navigate.
  WidgetsBinding.instance.addPostFrameCallback((_) => push?.start(container));
}

class ToastieApp extends ConsumerWidget {
  const ToastieApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Openfloor',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ref.watch(themeModeProvider),
      routerConfig: router,
      scaffoldMessengerKey: scaffoldMessengerKey,
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      supportedLocales: const [Locale('en', 'GB'), Locale('en', 'US')],
      builder: (context, child) {
        // Cap text scaling so dense rows stay legible without clipping.
        final mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(textScaler: mq.textScaler.clamp(maxScaleFactor: 1.6)),
          // The email prompt sits over the navigator; the intro plays over both.
          child: IntroSplash(child: EmailGate(child: child!)),
        );
      },
    );
  }
}
