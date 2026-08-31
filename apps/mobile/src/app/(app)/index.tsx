import { Link } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { meetingRoleLabel } from '@/domain/meeting-roles';
import type { UpcomingAssignment } from '@/features/dashboard/use-dashboard';
import { assignmentKey, useDashboard } from '@/features/dashboard/use-dashboard';
import { formatCountdown, useCountdown } from '@/features/shared/use-countdown';
import { formatDate, formatMeetingDate } from '@/lib/format';
import { useSession } from '@/session';

export default function DashboardScreen() {
  const { session, activeContext } = useSession();
  const dashboard = useDashboard();
  const countdown = useCountdown(dashboard.nextMeeting?.dateTime);

  const clubName =
    activeContext?.kind === 'club'
      ? session?.memberships.find((m) => m.clubId === activeContext.clubId)?.clubName
      : null;

  if (dashboard.isLoading) return <LoadingState label="Loading your club" />;
  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={dashboard.isRefetching} onRefresh={dashboard.refetch} />
          }
        >
          <View style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary">
              {clubName ?? 'Toastie'}
            </ThemedText>
            <ThemedText type="subtitle">
              {session ? `Hello, ${session.user.firstName}` : 'Hello'}
            </ThemedText>
          </View>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              NEXT MEETING
            </ThemedText>
            {dashboard.nextMeeting ? (
              <Link href={`/meetings/${dashboard.nextMeeting.id}`}>
                <View style={styles.cardBody}>
                  <ThemedText type="default">
                    {dashboard.nextMeeting.theme ??
                      `Meeting #${dashboard.nextMeeting.meetingNumber}`}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatMeetingDate(dashboard.nextMeeting.dateTime)}
                    {countdown ? ` · ${formatCountdown(countdown)}` : ''}
                  </ThemedText>
                </View>
              </Link>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Nothing published yet. Any member can build the next agenda.
              </ThemedText>
            )}
          </Card>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              YOUR ASSIGNMENTS
            </ThemedText>
            {dashboard.assignments.length ? (
              dashboard.assignments.map((assignment) => (
                <ThemedText key={assignmentKey(assignment)} type="default">
                  {describeAssignment(assignment)}
                </ThemedText>
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                You have no role at the next meeting.
              </ThemedText>
            )}
          </Card>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              YOUR LAST SPEECH
            </ThemedText>
            {dashboard.recentSpeech ? (
              <View style={styles.cardBody}>
                <ThemedText type="default">
                  {dashboard.recentSpeech.title ?? 'Untitled speech'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    formatDate(dashboard.recentSpeech.date),
                    dashboard.recentSpeech.pathway,
                    dashboard.recentSpeech.projectName,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No speeches recorded yet.
              </ThemedText>
            )}
          </Card>

          {dashboard.activity.length ? (
            <Card>
              <ThemedText type="smallBold" themeColor="textSecondary">
                CLUB PULSE
              </ThemedText>
              {dashboard.activity.map((entry) => (
                <View key={entry.id} style={styles.activityRow}>
                  <ThemedText type="small">{entry.summary}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(entry.createdAt)}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function describeAssignment(assignment: UpcomingAssignment): string {
  switch (assignment.kind) {
    case 'role':
      return meetingRoleLabel(assignment.roleKey);
    case 'speech':
      return `Speech ${assignment.order}: ${assignment.title ?? assignment.project ?? 'title to come'}`;
    case 'evaluation':
      return `Evaluating ${assignment.speakerName}`;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.half,
  },
  cardBody: {
    gap: Spacing.half,
  },
  activityRow: {
    gap: Spacing.half,
  },
});
