import { useSyncExternalStore } from 'react';
import { Appearance, type useColorScheme as useRNColorScheme } from 'react-native';

type ColorSchemeName = ReturnType<typeof useRNColorScheme>;

/**
 * The web build renders statically (`web.output: "static"` in app.json), so the
 * colour scheme has to be recomputed on the client — the build has no browser
 * to ask.
 *
 * `useSyncExternalStore` is the mechanism for exactly that: `getServerSnapshot`
 * supplies the value used during static rendering and the first hydration pass,
 * then React swaps in the real one. The previous version flipped a `hasHydrated`
 * flag from an effect, which does the same job by causing a second render — and
 * trips `react-hooks/set-state-in-effect`.
 */
const subscribe = (onStoreChange: () => void) => {
  const subscription = Appearance.addChangeListener(onStoreChange);
  return () => subscription.remove();
};

const getSnapshot = (): ColorSchemeName => Appearance.getColorScheme() ?? 'light';

const getServerSnapshot = (): ColorSchemeName => 'light';

export function useColorScheme(): ColorSchemeName {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
