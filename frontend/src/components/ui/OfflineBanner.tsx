import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useQueryClient } from '@tanstack/react-query';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const qc = useQueryClient();
  const translateY = useRef(new Animated.Value(-60)).current;

  const isOffline = !isConnected || isInternetReachable === false;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, translateY]);

  const handleRetry = () => {
    // Refetch tất cả active queries
    qc.refetchQueries({ type: 'active' });
  };

  return (
    <Animated.View
      style={{ transform: [{ translateY }] }}
      className="absolute top-0 left-0 right-0 z-50 bg-red-500 px-4 py-3 flex-row items-center justify-between"
      pointerEvents={isOffline ? 'auto' : 'none'}
    >
      <View className="flex-row items-center flex-1">
        <Text className="text-white text-sm mr-2">📡</Text>
        <Text className="text-white text-sm font-medium">Không có kết nối mạng</Text>
      </View>
      <TouchableOpacity
        onPress={handleRetry}
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
        className="px-3 py-1 rounded-lg"
      >
        <Text className="text-white text-xs font-semibold">Thử lại</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
