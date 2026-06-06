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
import { MaterialIcons } from '@expo/vector-icons';
import { useContentHistory } from '@/features/content/hooks';
import { CardSkeleton } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppHeader } from '@/components/layout/AppHeader';
import type { ContentHistoryItem, GeneratedContentItem } from '@/types/api';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// ─── Platform chip — text only, no emoji ─────────────────────────────────────

function PlatformChip({ platform }: { platform: string }) {
  return (
    <View className="bg-gray-100 px-2 py-0.5 rounded-full">
      <Text className="text-xs text-gray-600 font-medium">{platform}</Text>
    </View>
  );
}

// ─── HistoryItemCard ──────────────────────────────────────────────────────────

interface HistoryItemCardProps {
  item: ContentHistoryItem;
  onPress: (item: ContentHistoryItem) => void;
}

function HistoryItemCard({ item, onPress }: HistoryItemCardProps) {
  // Lấy content hiển thị: nếu đã edit thì gộp nội dung chỉnh sửa vào nội dung gốc đầu tiên làm fallback
  const firstContent = item.generatedContent[0] ?? {};
  const displayContent: Partial<GeneratedContentItem> = item.isEdited && item.userEditedContent
    ? { ...firstContent, ...item.userEditedContent }
    : firstContent;

  const hook = displayContent.hook ?? '';
  const platform = displayContent.platform ?? firstContent.platform ?? '';

  const formattedDate = item.createdAt
    ? format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })
    : '';

  const platforms = item.generatedContent.map((c) => c.platform);
  const uniquePlatforms = [...new Set(platforms)];

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-gray-700"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}
    >
      {/* Header: date + edited badge */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs text-gray-400 dark:text-gray-500">{formattedDate}</Text>
        {item.isEdited && (
          <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
            <Text className="text-xs text-amber-600 dark:text-amber-400 font-medium">Đã chỉnh sửa</Text>
          </View>
        )}
      </View>

      {/* Platform chips — text only */}
      <View className="flex-row flex-wrap gap-1 mb-2">
        {uniquePlatforms.map((p) => (
          <PlatformChip key={p} platform={p} />
        ))}
      </View>

      {/* Hook preview */}
      <Text className="text-sm text-gray-800 dark:text-gray-100 font-medium" numberOfLines={2}>
        {hook || 'Không có nội dung'}
      </Text>

      <View className="flex-row items-center justify-end mt-2">
        <Text className="text-xs text-primary-500 font-medium">Xem chi tiết →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function HistorySkeletonList() {
  return (
    <View className="px-4 pt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useContentHistory();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Flatten infinite query pages
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

  const handleItemPress = useCallback(
    (item: ContentHistoryItem) => {
      router.push(`/(tabs)/history/${item.id}` as any);
    },
    [router]
  );

  // Loading state — skeleton
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <AppHeader title="Lịch sử" subtitle="Nội dung đã tạo trước đó" />
        <HistorySkeletonList />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Logo Header */}
      <AppHeader
        title="Lịch sử"
        subtitle={
          items.length > 0
            ? `${data?.pages[0]?.totalCount ?? 0} nội dung đã tạo`
            : 'Nội dung đã tạo trước đó'
        }
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HistoryItemCard item={item} onPress={handleItemPress} />
        )}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
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
            iconName="history"
            title="Chưa có lịch sử"
            description="Tạo nội dung đầu tiên của bạn để xem lịch sử tại đây"
            actionLabel="Tạo nội dung ngay"
            onAction={() => router.push('/(tabs)/generate' as any)}
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
