/**
 * Self-service account deletion — required of any app that lets people
 * register (Google Play's data-deletion policy), and the one screen in the app
 * whose job is to talk someone out of a mistake before honouring their request.
 *
 * The mistake is specific and predictable. In a club app, "delete my account"
 * reads as "get me out of this club" — and it does not do that. Deleting the
 * `User` reverts their `Membership` rows to unclaimed (`onDelete: SetNull`),
 * so the club's roster and every agenda, speech and evaluation keyed on
 * `membershipId` survive untouched. Someone expecting a clean exit gets the
 * opposite: no way back in, and their name still on the roster.
 *
 * So this is a screen rather than a confirm dialog. It states what goes and
 * what stays before asking for anything, and it names the club-leaving case
 * explicitly, because an alert with two buttons cannot do either.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError, ApiNotConfiguredError, deleteAccount } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/session';

const REMOVED = [
  'Your sign-in and password',
  'Your phone number and email address',
  'Your profile, photo and bio',
  'Every device you are signed in on',
];

const KEPT = [
  'Your name on your club roster',
  'Speeches you delivered',
  'Evaluations you gave and received',
  'Your attendance at past meetings',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* The server is the authority on whether a club would be left without an
     administrator — it alone can count the *other* admins. The session does say
     whether this member is one, which is enough to warn before they type a
     password rather than after. */
  const adminClubs = (session?.memberships ?? [])
    .filter((membership) => membership.roles.includes('ClubAdmin'))
    .map((membership) => membership.clubName);

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }

    setBusy(true);
    try {
      await deleteAccount(password);
      // The account is gone; the tokens went with it. `signOut` is best-effort
      // about the network and clears local state regardless, and the root
      // layout's guard moves the user to sign-in on its own.
      await signOut();
    } catch (err) {
      setError(describeDeleteError(err));
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="default">
            This cannot be undone. Read what happens before you confirm.
          </ThemedText>

          <Card>
            <ThemedText type="smallBold" themeColor="danger">
              REMOVED
            </ThemedText>
            {REMOVED.map((line) => (
              <ThemedText key={line} type="small">
                {line}
              </ThemedText>
            ))}
          </Card>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              KEPT BY YOUR CLUB
            </ThemedText>
            {KEPT.map((line) => (
              <ThemedText key={line} type="small">
                {line}
              </ThemedText>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Your club keeps its meeting records the way it keeps its minutes. You will not be able
              to sign in to see them.
            </ThemedText>
          </Card>

          {/* The redirect that stops the wrong outcome. Rosters are managed by
              club officers, so there is no self-service way to leave — and
              deleting an account is not one either. */}
          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              WANTED TO LEAVE YOUR CLUB?
            </ThemedText>
            <ThemedText type="small">
              Deleting your account will not take you off the roster. Ask a club officer to remove
              you instead — they manage the roster.
            </ThemedText>
          </Card>

          {adminClubs.length > 0 ? (
            <Card>
              <ThemedText type="smallBold" themeColor="warning">
                YOU ADMINISTER {adminClubs.length > 1 ? 'THESE CLUBS' : 'A CLUB'}
              </ThemedText>
              <ThemedText type="small">
                {adminClubs.join(', ')}. Make someone else a club admin first — a club left with no
                administrator cannot be fixed from inside the app.
              </ThemedText>
            </Card>
          ) : null}

          <TextField
            label="Confirm with your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            autoCapitalize="none"
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={submit}
            error={error}
          />

          <View style={styles.actions}>
            <Button title="Delete my account" onPress={submit} loading={busy} />
            <Button
              title="Keep my account"
              variant="secondary"
              onPress={() => router.back()}
              disabled={busy}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function describeDeleteError(error: unknown): string {
  if (error instanceof ApiNotConfiguredError) return error.message;

  if (error instanceof ApiError) {
    if (error.code === 'LAST_CLUB_ADMIN') {
      const clubs = clubNamesFrom(error.body);
      const named = clubs.length ? ` of ${clubs.join(', ')}` : '';
      return `You are the only club admin${named}. Make another member a club admin, then come back.`;
    }
    if (error.code === 'LAST_SUPER_ADMIN') {
      return 'You are the only super admin. Hand that over before deleting your account.';
    }
    if (error.status === 401) return 'That password is not correct.';
    return error.message;
  }

  return "Can't reach the server. Check your connection and try again.";
}

/** The 400 body carries `clubs: string[]` alongside the code. Read defensively
 * — an error path is the worst place to throw a second error. */
function clubNamesFrom(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return [];
  const clubs = (body as { clubs?: unknown }).clubs;
  if (!Array.isArray(clubs)) return [];
  return clubs.filter((club): club is string => typeof club === 'string');
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
  actions: {
    gap: Spacing.two,
  },
});
