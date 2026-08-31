import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Prospect } from '@/api';
import { fetchGuests } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import type { ProspectStage } from '@/domain/enums';
import { PROSPECT_STAGES } from '@/domain/enums';
import { useScopedKey } from '@/features/shared/scoped-query';
import { formatDate, fullName } from '@/lib/format';
import { useCan } from '@/session';

const STAGE_LABELS: Record<ProspectStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  'joined-meetings': 'Attending meetings',
  'joined-club': 'Joined the club',
  'not-interested': 'Not interested',
};

export default function PeopleScreen() {
  const can = useCan();
  const allowed = can('read', 'guest');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: useScopedKey('guests'),
    queryFn: fetchGuests,
    enabled: allowed,
  });

  const sections = useMemo(() => buildSections(data ?? []), [data]);

  if (!allowed) {
    return (
      <EmptyState
        title="No access"
        hint="The guest pipeline is managed by VP Membership and the club's officers."
      />
    );
  }
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              title="No guests logged"
              hint="Log a visitor the day they attend, so their history starts from the first meeting."
            />
          }
          renderSectionHeader={({ section }) => (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              {section.title.toUpperCase()} · {section.data.length}
            </ThemedText>
          )}
          renderItem={({ item }) => <GuestRow guest={item} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function GuestRow({ guest }: { guest: Prospect }) {
  return (
    <Card style={styles.row}>
      <ThemedText type="default">{fullName(guest.firstName, guest.lastName)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {guest.visitCount} {guest.visitCount === 1 ? 'visit' : 'visits'}
        {guest.lastVisit ? ` · last ${formatDate(guest.lastVisit)}` : ''}
      </ThemedText>
      {guest.phone || guest.email ? (
        <ThemedText type="small" themeColor="textSecondary">
          {[guest.phone, guest.email].filter(Boolean).join(' · ')}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/**
 * Grouped by pipeline stage, in pipeline order. `not-interested` sorts last
 * because it is terminal — it is a record kept, not a stage to work.
 */
function buildSections(guests: Prospect[]) {
  return PROSPECT_STAGES.map((stage) => ({
    title: STAGE_LABELS[stage],
    data: guests.filter((guest) => guest.stage === stage),
  })).filter((section) => section.data.length > 0);
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
});
