import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useMe, useQuota, authKeys } from '@/features/auth/hooks';
import { useAuthStore } from '@/features/auth/store';
import { QuotaBar } from '@/components/ui/QuotaBar';
import { TierBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { AppHeader } from '@/components/layout/AppHeader';

export default function DashboardScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { displayName } = useAuthStore();

  const { data: me, isLoading: meLoading } = useMe();
  const { data: quota, isLoading: quotaLoading } = useQuota();

  const isLoading = meLoading || quotaLoading;

  const onRefresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: authKeys.me }),
      qc.invalidateQueries({ queryKey: authKeys.quota }),
    ]);
  };

  const tier = me?.tier ?? 'Free';
  const remaining = quota?.remainingQuota ?? 0;
  const used = quota?.usedToday ?? 0;
  const limit = quota?.dailyQuotaLimit ?? 5;
  const isUnlimited = quota?.isUnlimited ?? false;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-900"
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor="#111827"
        />
      }
    >
      {/* Logo Header */}
      <AppHeader
        title="SocialSence"
        subtitle="Tạo nội dung AI thông minh"
        rightSlot={isLoading ? undefined : <TierBadge tier={tier} />}
      />

      <View className="flex-1 px-5 pt-5 pb-8">
        {/* Greeting */}
        <View className="mb-5">
          {isLoading ? (
            <SkeletonLoader width={200} height={22} borderRadius={8} />
          ) : (
            <Text className="text-xl font-bold text-gray-900 dark:text-white">
              Xin chào, {me?.displayName ?? displayName ?? 'bạn'} 👋
            </Text>
          )}
          <Text className="text-sm text-gray-500 mt-0.5">Hôm nay bạn muốn tạo gì?</Text>
        </View>

        {/* Quota Card */}
        <Card variant="outlined" className="mb-4">
          {isLoading ? (
            <View style={{ gap: 8 }}>
              <SkeletonLoader height={14} width="50%" borderRadius={6} />
              <SkeletonLoader height={8} width="100%" borderRadius={4} />
              <SkeletonLoader height={12} width="40%" borderRadius={6} />
            </View>
          ) : (
            <QuotaBar
              used={used}
              limit={limit}
              isUnlimited={isUnlimited}
              tier={tier}
            />
          )}
        </Card>

        {/* Upgrade prompt khi hết quota */}
        {!isLoading && remaining === 0 && !isUnlimited && (
          <Card variant="elevated" className="mb-4">
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <Text className="text-2xl">🚀</Text>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900 text-sm">
                  Hết lượt hôm nay
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Nâng cấp để tạo thêm nội dung ngay
                </Text>
              </View>
              <TouchableOpacity
                className="bg-primary-500 px-3 py-2 rounded-lg"
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Text className="text-white text-xs font-semibold">Nâng cấp</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Quick Actions */}
        <Text className="text-base font-semibold text-gray-900 mb-3">Tạo nội dung</Text>

        <View style={{ gap: 12, marginBottom: 24 }}>
          {/* TrendBased */}
          <TouchableOpacity
            className="bg-gray-900 rounded-2xl p-4 flex-row items-center"
            style={{ gap: 12 }}
            onPress={() => router.push('/(tabs)/generate')}
            activeOpacity={0.85}
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <MaterialIcons name="trending-up" size={22} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base">Theo xu hướng</Text>
              <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                AI chọn trend phù hợp với persona của bạn
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* PersonaDriven */}
          <TouchableOpacity
            className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-row items-center"
            style={{ gap: 12 }}
            onPress={() => router.push('/(tabs)/generate')}
            activeOpacity={0.85}
          >
            <View className="w-10 h-10 bg-gray-200 rounded-xl items-center justify-center">
              <MaterialIcons name="auto-awesome" size={22} color="#111827" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-semibold text-base">Theo persona</Text>
              <Text className="text-gray-500 text-xs mt-0.5">
                AI áp dụng công thức tâm lý cho ngành của bạn
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        <Text className="text-base font-semibold text-gray-900 mb-3">Khám phá</Text>
        <View className="flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-3 items-center"
            style={{ gap: 6 }}
            onPress={() => router.push('/(tabs)/trends')}
          >
            <MaterialIcons name="trending-up" size={26} color="#111827" />
            <Text className="text-xs font-medium text-gray-700">Xu hướng</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-3 items-center"
            style={{ gap: 6 }}
            onPress={() => router.push('/(tabs)/history')}
          >
            <MaterialIcons name="history" size={26} color="#111827" />
            <Text className="text-xs font-medium text-gray-700">Lịch sử</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-3 items-center"
            style={{ gap: 6 }}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <MaterialIcons name="person" size={26} color="#111827" />
            <Text className="text-xs font-medium text-gray-700">Hồ sơ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
