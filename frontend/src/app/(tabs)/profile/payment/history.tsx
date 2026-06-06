import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePaymentHistory } from '@/features/payment/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/SkeletonLoader';
import type { PaymentHistoryItem, OrderStatus } from '@/types/api';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: OrderStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<OrderStatus, { bg: string; text: string; label: string }> = {
    Pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Chờ thanh toán' },
    Paid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Đã thanh toán' },
    Cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Đã hủy' },
    Expired: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Hết hạn' },
  };

  const { bg, text, label } = config[status];

  return (
    <View className={`${bg} px-2 py-0.5 rounded-full`}>
      <Text className={`text-xs font-medium ${text}`}>{label}</Text>
    </View>
  );
}

// ─── PaymentHistoryCard ───────────────────────────────────────────────────────

interface PaymentHistoryCardProps {
  item: PaymentHistoryItem;
}

function PaymentHistoryCard({ item }: PaymentHistoryCardProps) {
  const createdDate = format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi });
  const paidDate = item.paidAt
    ? format(new Date(item.paidAt), 'dd/MM/yyyy HH:mm', { locale: vi })
    : null;

  return (
    <Card variant="outlined" className="mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 mb-1">{item.tier}</Text>
          <Text className="text-xs text-gray-400">Mã đơn: #{item.orderCode}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View className="border-t border-gray-100 pt-2 mt-2">
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs text-gray-500">Số tiền:</Text>
          <Text className="text-sm font-semibold text-gray-900">
            {item.amount.toLocaleString('vi-VN')} đ
          </Text>
        </View>
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs text-gray-500">Ngày tạo:</Text>
          <Text className="text-xs text-gray-700">{createdDate}</Text>
        </View>
        {paidDate && (
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">Ngày thanh toán:</Text>
            <Text className="text-xs text-gray-700">{paidDate}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

// ─── Skeleton List ────────────────────────────────────────────────────────────

function HistorySkeletonList() {
  return (
    <View className="px-4 pt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

// ─── PaymentHistoryScreen ─────────────────────────────────────────────────────

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = usePaymentHistory();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-gray-900">Lịch sử thanh toán</Text>
        </View>
        <HistorySkeletonList />
      </SafeAreaView>
    );
  }

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
        <Text className="text-lg font-semibold text-gray-900">Lịch sử thanh toán</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.orderId)}
        renderItem={({ item }) => <PaymentHistoryCard item={item} />}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 32,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isRefetching}
            onRefresh={handleRefresh}
            tintColor="#111827"
            colors={['#111827']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <EmptyState
            iconName="receipt-long"
            title="Chưa có giao dịch"
            description="Lịch sử thanh toán sẽ hiển thị tại đây"
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#111827" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
