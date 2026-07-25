import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="kitchen-welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="inventory-setup" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
