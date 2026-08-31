import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { SessionProvider, useSession } from '@/session';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx is an answer, not a hiccup. Retrying a 403 just burns the user's
      // mobile data on a question the server already settled — and a meeting
      // room is exactly where that data is scarce (docs/PRD.md section 9).
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <SplashScreenController />
              <RootNavigator />
            </ThemeProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Holds the splash screen until the session has been restored from the
 * keychain, so a returning user never sees the sign-in screen flash past on
 * their way to the dashboard.
 */
function SplashScreenController() {
  const { status } = useSession();
  if (status !== 'restoring') SplashScreen.hide();
  return null;
}

function RootNavigator() {
  const { status } = useSession();
  const isSignedIn = status === 'signed-in';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      {/*
        Public share surfaces stay outside both guards on purpose. A guest
        opening an agenda link has no account and is not expected to get one
        (docs/PRD.md section 8) — guarding these would break the single most-shared
        link the product produces.
      */}
      <Stack.Screen name="agenda/[meetingId]" options={{ headerShown: true, title: 'Agenda' }} />
    </Stack>
  );
}
