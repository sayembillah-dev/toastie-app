import { ActivityIndicator, Pressable, type PressableProps, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const isInert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      // A button mid-request must not be pressable again — the API's evaluation
      // idempotency work exists because retried submissions duplicated rows
      // (docs/ROADMAP.md, "Now"). Not re-creating that class of bug on the client.
      disabled={isInert}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? theme.accent : theme.backgroundElement,
          borderColor: isPrimary ? theme.accent : theme.border,
          opacity: isInert ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.onAccent : theme.text} />
      ) : (
        <ThemedText
          type="default"
          style={[styles.label, { color: isPrimary ? theme.onAccent : theme.text }]}
        >
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
});
