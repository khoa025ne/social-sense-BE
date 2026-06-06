import React, { useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store';
import { useQuota } from '@/features/auth/hooks';
import { TabBarIcon } from '@/components/layout/TabBarIcon';

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roles } = useAuthStore();
  const { data: quota } = useQuota();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isAdmin = roles.includes('Admin');
  const remainingQuota = quota?.remainingQuota ?? 99;
  const isUnlimited = quota?.isUnlimited ?? false;

  // Bottom sheet for quota exceeded
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%'], []);

  const handleGeneratePress = useCallback(
    (defaultHandler: (() => void) | null | undefined) => {
      if (!isUnlimited && remainingQuota === 0) {
        bottomSheetRef.current?.expand();
      } else {
        defaultHandler?.();
      }
    },
    [remainingQuota, isUnlimited]
  );

  const handleUpgradePress = () => {
    bottomSheetRef.current?.close();
    router.push('/(tabs)/profile');
  };

  const quotaBadge =
    !isUnlimited && remainingQuota <= 2 && remainingQuota > 0
      ? remainingQuota
      : undefined;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E7EB',
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarActiveTintColor: '#111827',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}
      >
        {/* Tab 1: Home */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Trang chủ',
            tabBarIcon: ({ focused, color }) => (
              <MaterialIcons name="home" size={26} color={focused ? '#111827' : '#9CA3AF'} />
            ),
          }}
        />

        {/* Tab 2: Trends */}
        <Tabs.Screen
          name="trends/index"
          options={{
            title: 'Xu hướng',
            tabBarIcon: ({ focused, color }) => (
              <MaterialIcons name="trending-up" size={26} color={focused ? '#111827' : '#9CA3AF'} />
            ),
          }}
        />

        {/* Tab 3: Generate — FAB elevated */}
        <Tabs.Screen
          name="generate/index"
          options={{
            title: '',
            tabBarIcon: ({ focused }) => (
              <View
                style={[
                  styles.fabContainer,
                  { backgroundColor: focused ? '#111827' : '#1F2937' },
                ]}
              >
                <MaterialIcons name="auto-awesome" size={26} color="#FFFFFF" />
                {quotaBadge !== undefined && (
                  <View style={styles.fabBadge}>
                    <Text style={styles.fabBadgeText}>{quotaBadge}</Text>
                  </View>
                )}
              </View>
            ),
            tabBarButton: ({ onPress, style, children, accessibilityState }) => (
              <TouchableOpacity
                onPress={() =>
                  handleGeneratePress(onPress as (() => void) | null | undefined)
                }
                style={[style, { top: -16 }]}
                accessibilityState={accessibilityState ?? undefined}
              >
                {children}
              </TouchableOpacity>
            ),
          }}
        />

        {/* Tab 4: History */}
        <Tabs.Screen
          name="history/index"
          options={{
            title: 'Lịch sử',
            tabBarIcon: ({ focused }) => (
              <MaterialIcons name="history" size={26} color={focused ? '#111827' : '#9CA3AF'} />
            ),
          }}
        />

        {/* Tab 5: Profile */}
        <Tabs.Screen
          name="profile/index"
          options={{
            title: 'Hồ sơ',
            tabBarIcon: ({ focused }) => (
              <MaterialIcons name="person" size={26} color={focused ? '#111827' : '#9CA3AF'} />
            ),
          }}
        />

        {/* Tab 6: Admin — conditional (hidden when not Admin) */}
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            href: isAdmin ? undefined : null,
            tabBarIcon: ({ focused }) => (
              <MaterialIcons name="admin-panel-settings" size={26} color={focused ? '#111827' : '#9CA3AF'} />
            ),
          }}
        />

        {/* ── Hidden sub-routes (not tabs, but need to be declared) ── */}
        <Tabs.Screen name="generate/alignment" options={{ href: null }} />
        <Tabs.Screen name="generate/result" options={{ href: null }} />
        <Tabs.Screen name="generate/image" options={{ href: null }} />
        <Tabs.Screen name="history/[id]" options={{ href: null }} />
        <Tabs.Screen name="profile/persona" options={{ href: null }} />
        <Tabs.Screen name="profile/knowledge" options={{ href: null }} />
        <Tabs.Screen name="profile/subscription" options={{ href: null }} />
        <Tabs.Screen name="profile/edit-profile" options={{ href: null }} />
        <Tabs.Screen name="profile/change-password" options={{ href: null }} />
        <Tabs.Screen name="profile/payment/plans" options={{ href: null }} />
        <Tabs.Screen name="profile/payment/checkout" options={{ href: null }} />
        <Tabs.Screen name="profile/payment/history" options={{ href: null }} />
      </Tabs>

      {/* Quota Exceeded Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB' }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetEmoji}>⚡</Text>
          <Text style={styles.sheetTitle}>Bạn đã dùng hết lượt hôm nay</Text>
          <Text style={styles.sheetDesc}>
            Nâng cấp lên gói Pro để tạo thêm 50 nội dung mỗi ngày.
          </Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgradePress}>
            <Text style={styles.upgradeBtnText}>Nâng cấp ngay →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.laterBtn}
            onPress={() => bottomSheetRef.current?.close()}
          >
            <Text style={styles.laterBtnText}>Để sau</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  sheetEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradeBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  laterBtn: {
    paddingVertical: 10,
  },
  laterBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
