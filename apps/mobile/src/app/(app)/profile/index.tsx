import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/states';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { fullName } from '@/lib/format';
import type { ActiveContext } from '@/session';
import { contextKey, useSession } from '@/session';

export default function ProfileScreen() {
  const { session, activeContext, contexts, switchContext, signOut } = useSession();

  if (!session) return <LoadingState />;

  const activeKey = contextKey(activeContext);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">
              {fullName(session.user.firstName, session.user.lastName)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {session.user.phone}
              {session.user.email ? ` · ${session.user.email}` : ''}
            </ThemedText>
          </View>

          {session.user.mustChangePassword ? (
            <Card>
              <ThemedText type="smallBold" themeColor="warning">
                CHANGE YOUR PASSWORD
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You are signed in with a password an officer generated for you. Change it so the
                one-time handoff record can be cleared.
              </ThemedText>
            </Card>
          ) : null}

          {/*
            The context picker. Switching is not cosmetic — it changes the
            X-Toastly-Context header on every request, and therefore which
            club's data the API will return at all (docs/TDD.md section 7.2).
          */}
          {contexts.length > 1 ? (
            <Card>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ACTING AS
              </ThemedText>
              {contexts.map((context) => (
                <ContextRow
                  key={contextKey(context)}
                  context={context}
                  isActive={contextKey(context) === activeKey}
                  label={describeContext(context, session)}
                  onPress={() => switchContext(context)}
                />
              ))}
            </Card>
          ) : null}

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              YOUR CLUBS
            </ThemedText>
            {session.memberships.length ? (
              session.memberships.map((membership) => (
                <View key={membership.membershipId} style={styles.row}>
                  <ThemedText type="default">{membership.clubName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {/* `ClubAdmin` is a role in the engine's model, not a
                        separate flag, so it reads out of the same list. */}
                    {membership.roles.join(', ') || 'Member'}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                You are not on a club roster yet.
              </ThemedText>
            )}
          </Card>

          <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />

          {/* Deliberately below Sign out and visually quieter than it. Google
              requires account deletion to be easy to find, not easy to hit by
              accident — and these two are the pair most likely to be confused
              in a hurry. */}
          <Link href="/profile/delete-account" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
            >
              <ThemedText type="small" themeColor="danger">
                Delete account
              </ThemedText>
            </Pressable>
          </Link>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ContextRow({
  isActive,
  label,
  onPress,
}: {
  context: ActiveContext;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [styles.contextRow, pressed && styles.pressed]}
    >
      <ThemedText type="default" themeColor={isActive ? 'accent' : 'text'}>
        {label}
      </ThemedText>
      {isActive ? (
        <ThemedText type="small" themeColor="accent">
          Active
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function describeContext(
  context: ActiveContext,
  session: NonNullable<ReturnType<typeof useSession>['session']>,
): string {
  switch (context.kind) {
    case 'club':
      return session.memberships.find((m) => m.clubId === context.clubId)?.clubName ?? 'A club';
    case 'org': {
      const assignment = session.orgAssignments.find(
        (a) => a.unitType === context.unitType && a.unitId === context.unitId,
      );
      return assignment ? `${assignment.unitName} (${assignment.role})` : 'Director';
    }
    case 'global':
      return 'Super Admin';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deleteRow: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  row: {
    gap: Spacing.half,
    paddingTop: Spacing.one,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
