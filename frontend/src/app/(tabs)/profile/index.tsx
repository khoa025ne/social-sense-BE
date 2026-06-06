import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useMe, useQuota, useLogout } from '@/features/auth/hooks';
import { TierBadge } from '@/components/ui/Badge';
import { QuotaBar } from '@/components/ui/QuotaBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AppHeader } from '@/components/layout/AppHeader';

// ─── QuickLinkCard ────────────────────────────────────────────────────────────

interface QuickLinkCardProps {
  iconName: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

function QuickLinkCard({ iconName, title, description, onPress }: QuickLinkCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="outlined" className="mb-3">
        <View className="flex-row items-center">
          <View className="w-12 h-12 bg-gray-100 rounded-xl items-center justify-center mr-3">
            <MaterialIcons name={iconName} size={22} color="#374151" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 mb-0.5">{title}</Text>
            <Text className="text-sm text-gray-500">{description}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#9CA3AF" />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useMe();
  const { data: quota, isLoading: quotaLoading } = useQuota();
  const logout = useLogout();

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (userLoading || quotaLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <AppHeader title="Hồ sơ" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <AppHeader title="Hồ sơ" subtitle={user?.email} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hồ sơ người dùng ─────────────────────────────── */}
        <Card variant="elevated" className="mb-6">
          <View className="items-center pt-4 pb-4">
            {/* Avatar — icon đơn sắc */}
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-3">
              <MaterialIcons name="person" size={40} color="#374151" />
            </View>

            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
              {user?.displayName ?? 'Người dùng'}
            </Text>

            {user?.tier && (
              <View className="mb-4">
                <TierBadge tier={user.tier} />
              </View>
            )}

            {quota && (
              <View className="w-full">
                <QuotaBar
                  used={quota.usedToday}
                  limit={quota.dailyQuotaLimit}
                  isUnlimited={quota.isUnlimited}
                  tier={quota.tier}
                />
              </View>
            )}
          </View>

          <View className="h-px bg-gray-100 mx-1" />

          {/* Nút action — icon đơn sắc */}
          <View className="flex-row pt-3 pb-1 gap-3">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200"
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/profile/edit-profile' as any)}
            >
              <MaterialIcons name="edit" size={16} color="#374151" />
              <Text className="text-sm font-semibold text-gray-700">Chỉnh sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200"
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/profile/change-password' as any)}
            >
              <MaterialIcons name="lock-outline" size={16} color="#374151" />
              <Text className="text-sm font-semibold text-gray-700">Đổi mật khẩu</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── Cài đặt ──────────────────────────────────────── */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">
          Cài đặt
        </Text>

        <QuickLinkCard
          iconName="tune"
          title="Phong cách & Đối tượng"
          description="Chỉnh sửa phong cách viết và tệp người xem bạn muốn hướng tới"
          onPress={() => router.push('/(tabs)/profile/persona' as any)}
        />

        <QuickLinkCard
          iconName="description"
          title="Tài liệu tham khảo"
          description="Thêm thông tin sản phẩm để AI tạo nội dung chính xác hơn"
          onPress={() => router.push('/(tabs)/profile/knowledge' as any)}
        />

        <QuickLinkCard
          iconName="credit-card"
          title="Gói dịch vụ"
          description="Xem và nâng cấp gói của bạn"
          onPress={() => router.push('/(tabs)/profile/subscription' as any)}
        />

        <QuickLinkCard
          iconName="receipt-long"
          title="Lịch sử thanh toán"
          description="Xem các giao dịch đã thực hiện"
          onPress={() => router.push('/(tabs)/profile/payment/history' as any)}
        />

        <View className="mt-6">
          <Button variant="outline" onPress={handleLogout}>
            Đăng xuất
          </Button>
        </View>

        <Text className="text-xs text-gray-400 text-center mt-6">
          SocialSence Mobile v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
