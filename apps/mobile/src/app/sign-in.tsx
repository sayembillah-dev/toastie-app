import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, ApiNotConfiguredError } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/session';

/** The API rejects anything else outright: "Phone must be exactly 11 digits". */
const PHONE_LENGTH = 11;

export default function SignInScreen() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || !password) {
      setError('Enter your phone number and password.');
      return;
    }
    if (!/^\d{11}$/.test(trimmedPhone)) {
      setError(`Phone number must be exactly ${PHONE_LENGTH} digits.`);
      return;
    }

    setBusy(true);
    try {
      await signIn(trimmedPhone, password);
      // No navigation call. The root layout's guard flips as soon as the
      // session lands, and Expo Router moves the user itself — redirecting here
      // as well would race that.
    } catch (err) {
      setError(describeSignInError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.safeArea}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <View style={styles.heading}>
                <ThemedText type="subtitle">Toastie</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Sign in to your club.
                </ThemedText>
              </View>

              <TextField
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                // Phone is the identifier, not email (docs/TDD.md section 6). The API
                // validates "exactly 11 digits", so this is number-pad rather
                // than phone-pad: the latter offers + * #, none of which the
                // server accepts, and the placeholder must not imply otherwise.
                keyboardType="number-pad"
                maxLength={PHONE_LENGTH}
                textContentType="telephoneNumber"
                autoComplete="tel"
                autoCapitalize="none"
                placeholder="01700000000"
                editable={!busy}
                returnKeyType="next"
              />

              <TextField
                label="Password"
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

              <Button title="Sign in" onPress={submit} loading={busy} />

              <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
                Added to a club roster but never signed up? Register with the phone number your
                officer used and your record is claimed automatically.
              </ThemedText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function describeSignInError(error: unknown): string {
  if (error instanceof ApiNotConfiguredError) return error.message;
  if (error instanceof ApiError) {
    // The API answers 401 for both a wrong password and an unknown phone
    // number, and this message keeps it that way — saying which one was wrong
    // would turn the sign-in form into a directory of who has an account.
    if (error.status === 401) return 'That phone number and password do not match.';
    if (error.status === 403) return 'This account is suspended. Contact a club officer.';
    return error.message;
  }
  return "Can't reach the server. Check your connection and try again.";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  form: {
    width: '100%',
    maxWidth: MaxContentWidth / 2,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  heading: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  footnote: {
    textAlign: 'center',
  },
});
