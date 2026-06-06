import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAdminDashboard } from '@/features/admin/hooks';
import { Card } from '@/components/ui/Card';

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  iconName: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  label: string;
  value: string | number;
  valueColor?: string;
}

function StatCard({ iconName, iconColor = '#111827', label, value, valueColor = '#111827' }: StatCardProps) {
  return (
    <Card variant="outlined" className="flex-1">
      <MaterialIcons name={iconName} size={24} color={iconColor} style={{ marginBottom: 4 }} />
      <Text style={{ color: valueColor }} className="text-xl font-bold">{value}</Text>
      <Text className="text-xs text-gray-500 mt-0.5">{label}</Text>
    </Card>
  );
}

// ─── MiniBarChart ─────────────────────────────────────────────────────────────

interface MiniBarChartProps {
  data: Array<{ date: string; contentGenerated: number; newUsers: number }>;
}

function MiniBarChart({ data }: MiniBarChartProps) {
  const maxContent = Math.max(...data.map((d) => d.contentGenerated), 1);

  return (
    <View>
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Hoạt động 7 ngày qua
      </Text>
      <View className="flex-row items-end justify-between" style={{ height: 80 }}>
        {data.map((item, idx) => {
          const barHeight = Math.max((item.contentGenerated / maxContent) * 72, 4);
          const dateLabel = item.date.slice(5); // MM-DD
          return (
            <View key={idx} className="items-center flex-1">
              <View
                className="bg-primary-400 rounded-t-sm w-5"
                style={{ height: barHeight }}
              />
              <Text className="text-xs text-gray-400 mt-1">{dateLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── AdminDashboardScreen ─────────────────────────────────────────────────────

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">Admin Panel</Text>
          <Text className="text-sm text-gray-500 mt-1">Tổng quan hệ thống</Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row gap-3 mb-3">
          <StatCard iconName="group" label="Tổng người dùng" value={data?.totalUsers ?? 0} />
          <StatCard
            iconName="check-circle"
            iconColor="#16a34a"
            label="Đang hoạt động"
            value={data?.activeUsers ?? 0}
            valueColor="#16a34a"
          />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard
            iconName="auto-awesome"
            label="Nội dung đã tạo"
            value={data?.totalContentGenerated ?? 0}
          />
          <StatCard iconName="menu-book" label="Tài liệu tham khảo" value={data?.totalKnowledgeItems ?? 0} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard
            iconName="vpn-key"
            iconColor="#16a34a"
            label="API Keys hoạt động"
            value={data?.activeApiKeys ?? 0}
            valueColor="#16a34a"
          />
          <StatCard
            iconName="pause-circle"
            iconColor="#d97706"
            label="Đang cooldown"
            value={data?.coolingDownApiKeys ?? 0}
            valueColor="#d97706"
          />
        </View>

        {/* 7-day chart */}
        {data?.last7DaysContent && data.last7DaysContent.length > 0 && (
          <Card variant="outlined" className="mb-4">
            <MiniBarChart data={data.last7DaysContent} />
          </Card>
        )}

        {/* Quick Links */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Quản lý
        </Text>

        {[
          { iconName: 'group' as const, title: 'Người dùng', desc: 'Quản lý tài khoản và tier', route: '/(tabs)/admin/users' },
          { iconName: 'vpn-key' as const, title: 'API Keys', desc: 'Quản lý key pool', route: '/(tabs)/admin/api-keys' },
          { iconName: 'bar-chart' as const, title: 'Thống kê', desc: 'So sánh theo kỳ', route: '/(tabs)/admin/stats' },
        ].map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <Card variant="outlined" className="mb-3">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center mr-3">
                  <MaterialIcons name={item.iconName} size={20} color="#111827" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{item.title}</Text>
                  <Text className="text-xs text-gray-500">{item.desc}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
