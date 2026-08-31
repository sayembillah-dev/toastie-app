import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { fetchMyClub } from '@/api';
import { ThemedView } from '@/components/themed-view';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AgendaView } from '@/features/meetings/agenda-view';
import { useMeeting } from '@/features/meetings/queries';
import { useScopedKey } from '@/features/shared/scoped-query';

export default function MeetingDetailScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const { data: meeting, isLoading, error, refetch, isRefetching } = useMeeting(meetingId);

  // The club is fetched only for its banner colour, so a failure here must not
  // take the agenda down with it — the banner falls back to the accent colour.
  const { data: club } = useQuery({
    queryKey: useScopedKey('my-club'),
    queryFn: fetchMyClub,
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!meeting) return <ErrorState error={new Error('Meeting not found')} />;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: meeting.theme ?? `Meeting #${meeting.meetingNumber}` }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <AgendaView meeting={meeting} bannerColor={club?.bannerColor} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
