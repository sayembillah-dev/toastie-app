/**
 * The public agenda behind a share link.
 *
 * Outside both auth guards (see the root layout): the person opening this is a
 * guest or a visiting speaker who has no account and is not expected to make
 * one (docs/PRD.md section 8). It calls the `public/meetings/...` route, which sends
 * no token and no context header.
 */

import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AgendaView } from '@/features/meetings/agenda-view';
import { usePublicMeeting } from '@/features/meetings/queries';

export default function PublicAgendaScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const { data: meeting, isLoading, error, refetch } = usePublicMeeting(meetingId);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!meeting) return <ErrorState error={new Error('Agenda not found')} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <AgendaView meeting={meeting} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            Shared from Toastie. You do not need an account to view this agenda.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  footer: {
    textAlign: 'center',
  },
});
