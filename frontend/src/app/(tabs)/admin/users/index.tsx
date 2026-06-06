import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAdminUsers } from '@/features/admin/hooks';
import { CardSkeleton } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AdminUser } from '@/types/api';

// ─── UserRow ──────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: AdminUser;
  onPress: () => void;
}

function UserRow({ user, onPress }: UserRowProps) {
  const tierColors: Record<string, string> = {
    Free: 'text-gray-500',
    Pro: 'text-primary-600',
    Ultra: 'text-amber-600',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center"
    >
      <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3">
        <MaterialIcons name="person" size={20} color="#374151" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
          {user.displayName}
        </Text>
        <Text className="text-xs text-gray-500" numberOfLines={1}>
          {user.email}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`text-xs font-semibold ${tierColors[user.tier] ?? 'text-gray-500'}`}>
          {user.tier}
        </Text>
        <View
          className={`mt-1 w-2 h-2 rounded-full ${user.isActive ? 'bg-green-400' : 'bg-red-400'}`}
        />
      </View>
      <Text className="text-gray-400 ml-2">›</Text>
    </TouchableOpacity>
  );
}

// ─── AdminUsersScreen ─────────────────────────────────────────────────────────

export default function AdminUsersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useAdminUsers(debouncedSearch || undefined);

  const users = data?.pages.flatMap((p) => p.data) ?? [];

  // Debounce search
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(text), 400);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="px-4 pt-4 pb-2">
          <Text className="text-xl font-bold text-gray-900">Người dùng</Text>
        </View>
        <View className="px-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Người dùng</Text>
      </View>

      {/* Search */}
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <TextInput
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Tìm theo tên hoặc email..."
          className="bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-800"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onPress={() => router.push(`/(tabs)/admin/users/${item.id}` as any)}
          />
        )}
        contentContainerStyle={{ flexGrow: 1 }}
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
          <EmptyState iconName="group" title="Không tìm thấy người dùng" />
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
