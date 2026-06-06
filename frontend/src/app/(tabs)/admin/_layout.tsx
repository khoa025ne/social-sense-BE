import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users/index" options={{ title: 'Người dùng' }} />
      <Stack.Screen name="users/[id]" options={{ title: 'Chi tiết người dùng' }} />
      <Stack.Screen name="api-keys" options={{ title: 'API Keys' }} />
      <Stack.Screen name="stats" options={{ title: 'Thống kê' }} />
    </Stack>
  );
}
