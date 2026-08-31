import { Link } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import type { MeetingSummary } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { sortByDateDescending, useMeetings } from '@/features/meetings/queries';
import { formatMeetingDate } from '@/lib/format';
import { useCan } from '@/session';

export default function MeetingsScreen() {
  const can = useCan();
  const { data, isLoading, error, refetch, isRefetching } = useMeetings();

  const sections = useMemo(() => buildSections(data ?? []), [data]);

  if (!can('read', 'meeting')) {
    return <EmptyState title="No access" hint="Your role does not include meeting access." />;
  }
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            title="No meetings yet"
            hint="Any member of this club can create the first agenda."
          />
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
            {section.title.toUpperCase()}
          </ThemedText>
        )}
        renderItem={({ item }) => <MeetingRow meeting={item} />}
      />
    </ThemedView>
  );
}

function MeetingRow({ meeting }: { meeting: MeetingSummary }) {
  return (
    <Link href={`/meetings/${meeting.id}`} asChild>
      <Card style={styles.row}>
        <View style={styles.rowHeader}>
          <ThemedText type="default" style={styles.rowTitle}>
            {meeting.theme ?? `Meeting #${meeting.meetingNumber}`}
          </ThemedText>
          {/* A draft is visible to members who can edit it, but it must never
              read as a confirmed meeting (docs/ERD.md section 3, MeetingStatus). */}
          {meeting.status === 'draft' ? (
            <ThemedText type="small" themeColor="warning">
              Draft
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          #{meeting.meetingNumber} · {formatMeetingDate(meeting.dateTime)}
        </ThemedText>
      </Card>
    </Link>
  );
}

function buildSections(meetings: MeetingSummary[]) {
  const now = Date.now();
  const upcoming = meetings
    .filter((m) => new Date(m.dateTime).getTime() >= now)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  const past = sortByDateDescending(meetings.filter((m) => new Date(m.dateTime).getTime() < now));

  return [
    { title: 'Upcoming', data: upcoming },
    { title: 'Past', data: past },
  ].filter((section) => section.data.length > 0);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    gap: Spacing.half,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowTitle: {
    flexShrink: 1,
  },
});
