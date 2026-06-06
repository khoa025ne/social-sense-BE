import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTrends, useTrendTags } from '@/features/trends/hooks';
import { TrendCard } from '@/components/ui/TrendCard';
import { CardSkeleton } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppHeader } from '@/components/layout/AppHeader';
import type { TrendItem } from '@/types/api';

export default function TrendsScreen() {
  const router = useRouter();
  const [selectedTagId, setSelectedTagId] = useState<number | undefined>(undefined);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useTrends(selectedTagId);

  const { data: tags } = useTrendTags();

  // Flatten tất cả pages thành 1 mảng
  const trends: TrendItem[] = data?.pages.flatMap((p) => p.items) ?? [];

  const handleGeneratePress = useCallback(
    (trendId: number) => {
      router.push({
        pathname: '/(tabs)/generate',
        params: { trendId: String(trendId) },
      });
    },
    [router]
  );

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Logo Header */}
      <AppHeader title="Xu hướng" subtitle="Các chủ đề đang hot hôm nay" />

      {/* Tag Filter Bar — horizontal scroll */}
      {tags && tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ height: 52 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8, alignItems: 'center' }}
        >
          {/* "Tất cả" option */}
          <TouchableOpacity
            className={`px-3 py-1.5 rounded-full border ${
              selectedTagId === undefined
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white border-gray-200'
            }`}
            onPress={() => setSelectedTagId(undefined)}
          >
            <Text
              className={`text-xs font-medium ${
                selectedTagId === undefined ? 'text-white' : 'text-gray-600'
              }`}
            >
              Tất cả
            </Text>
          </TouchableOpacity>

          {tags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              className={`px-3 py-1.5 rounded-full border ${
                selectedTagId === tag.id
                  ? 'bg-primary-500 border-primary-500'
                  : 'bg-white border-gray-200'
              }`}
              onPress={() => setSelectedTagId(tag.id)}
            >
              <Text
                className={`text-xs font-medium ${
                  selectedTagId === tag.id ? 'text-white' : 'text-gray-600'
                }`}
              >
                {tag.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Trend List */}
      {isLoading ? (
        // Skeleton loader khi đang tải lần đầu
        <View className="px-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      ) : trends.length === 0 ? (
        <EmptyState
          icon="📭"
          title="Chưa có xu hướng nào"
          description="Thử chọn tag khác hoặc quay lại sau"
          actionLabel="Làm mới"
          onAction={() => refetch()}
        />
      ) : (
        <FlatList
          data={trends}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TrendCard trend={item} onGeneratePress={handleGeneratePress} />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          // Pull-to-refresh
          onRefresh={refetch}
          refreshing={isRefetching}
          // Infinite scroll
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator
                color="#111827"
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
