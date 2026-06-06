import '../global.css';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/features/auth/store';
import { getAccessToken } from '@/lib/secureStore';
import { getMe } from '@/features/auth/api';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { AppLogo } from '@/components/ui/AppLogo';

// ─── AuthGate ─────────────────────────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, hasContext, isLoading, setAuth, setLoading, clearAuth } = useAuthStore();

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getAccessToken();
        if (!token) {
          clearAuth();
          return;
        }
        // Token exists — fetch user profile to confirm validity
        const user = await getMe();
        setAuth({
          userId: user.id,
          accessToken: token,
          refreshToken: '',
          email: user.email,
          displayName: user.displayName,
          hasContext: user.hasContext,
        });
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else if (!hasContext) {
      if (!inOnboarding) router.replace('/onboarding');
    } else {
      if (!inTabs) router.replace('/(tabs)');
    }
  }, [isAuthenticated, hasContext, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <View className="items-center" style={{ gap: 16 }}>
          <View className="w-20 h-20 bg-gray-100 rounded-2xl items-center justify-center border border-gray-200">
            <AppLogo size={44} color="#111827" />
          </View>
          <ActivityIndicator color="#111827" size="small" />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

// ─── RootLayout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ErrorBoundary>
            {/* Offline banner — non-blocking, floats above all content */}
            <OfflineBanner />
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }} />
            </AuthGate>
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
