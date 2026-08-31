import AppTabs from '@/components/app-tabs';

/**
 * The signed-in shell. Reached only when the root layout's `Stack.Protected`
 * guard is satisfied, so every screen below can assume a session exists.
 */
export default function AppLayout() {
  return <AppTabs />;
}
