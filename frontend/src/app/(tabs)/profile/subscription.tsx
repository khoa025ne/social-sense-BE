import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '@/features/payment/hooks';
import { Card } from '@/components/ui/Card';
import { TierBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { data: subscription, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = subscription?.isActive ?? false;
  const normalizedTier = subscription?.tier === 'Enterprise' ? 'Ultra' : (subscription?.tier ?? 'Free');
  const expiryDate = subscription?.expiresAt
    ? format(new Date(subscription.expiresAt), 'dd/MM/yyyy', { locale: vi })
    : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/profile' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Gói dịch vụ</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Tier */}
        <Card variant="elevated" className="mb-4">
          <Text className="text-xs text-gray-400 uppercase tracking-wide mb-2">Gói hiện tại</Text>
          <View className="flex-row items-center justify-between mb-4">
            <TierBadge tier={(normalizedTier as any)} />
            <View
              className={`px-3 py-1 rounded-full ${
                isActive ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  isActive ? 'text-green-700' : 'text-gray-600'
                }`}
              >
                {subscription?.status === 'Active' ? 'Đang hoạt động' : 'Không hoạt động'}
              </Text>
            </View>
          </View>

          {isActive && expiryDate && (
            <>
              <View className="mb-3">
                <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Ngày hết hạn
                </Text>
                <Text className="text-sm text-gray-800 font-medium">{expiryDate}</Text>
              </View>

              {subscription?.daysRemaining !== null && (
                <View className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Text className="text-sm text-blue-700">
                    Còn {subscription?.daysRemaining} ngày sử dụng
                  </Text>
                </View>
              )}
            </>
          )}
        </Card>

        {/* Actions */}
        <View className="gap-3">
          <Button
            variant="primary"
            onPress={() => router.push('/(tabs)/profile/payment/plans' as any)}
          >
            {normalizedTier === 'Free' ? 'Nâng cấp gói' : 'Thay đổi gói'}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
