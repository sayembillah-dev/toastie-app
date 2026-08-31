import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ApiError, ApiNotConfiguredError } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.accent} />
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.centered}>
      <ThemedText type="default">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Turn a thrown error into something a club officer can act on.
 *
 * Three cases earn their own copy because each has a different fix, and
 * "Something went wrong" would send the user looking in the wrong place:
 * the app has no API host configured, the server rejected the active context,
 * or the network is down.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, hint, retryable } = describe(error);

  return (
    <View style={styles.centered}>
      <ThemedText type="default" themeColor="danger">
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
        {hint}
      </ThemedText>
      {onRetry && retryable ? (
        <Button title="Try again" variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}

function describe(error: unknown): { title: string; hint: string; retryable: boolean } {
  if (error instanceof ApiNotConfiguredError) {
    return {
      title: 'No API configured',
      hint: 'Set EXPO_PUBLIC_API_URL in .env to the API origin, then restart the dev server. See .env.example.',
      retryable: false,
    };
  }

  if (error instanceof ApiError) {
    if (error.code === 'CONTEXT_NOT_HELD') {
      return {
        title: 'That club is no longer yours to view',
        hint: 'Your membership or director assignment may have changed. Switch context, or sign out and back in.',
        retryable: false,
      };
    }
    if (error.status === 403) {
      return {
        title: 'Not permitted',
        hint: 'Your club role does not allow this. An officer can change your permissions in Club Admin.',
        retryable: false,
      };
    }
    if (error.status === 404) {
      return { title: 'Not found', hint: 'This record may have been deleted.', retryable: false };
    }
    return { title: 'Request failed', hint: error.message, retryable: true };
  }

  return {
    title: "Can't reach the server",
    hint: 'Check your connection and try again. Toastie needs a network connection for everything but the offline screen.',
    retryable: true,
  };
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  centeredText: {
    textAlign: 'center',
  },
});
