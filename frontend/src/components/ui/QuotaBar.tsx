import React from 'react';
import { View, Text } from 'react-native';

interface QuotaBarProps {
  used: number;
  limit: number;
  isUnlimited: boolean;
  tier: string;
}

export function QuotaBar({ used, limit, isUnlimited, tier }: QuotaBarProps) {
  if (isUnlimited) {
    return (
      <View className="bg-primary-50 rounded-xl p-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-medium text-gray-700">Lượt tạo hôm nay</Text>
          <Text className="text-xs font-semibold text-primary-500">{tier}</Text>
        </View>
        <Text className="text-primary-500 font-semibold text-base">∞ Không giới hạn</Text>
      </View>
    );
  }

  const percent = limit > 0 ? (used / limit) * 100 : 0;
  const remaining = limit - used;

  const barColor =
    percent < 20 ? 'bg-red-500' :
    percent < 50 ? 'bg-amber-500' :
    'bg-emerald-500';

  const textColor =
    percent < 20 ? 'text-red-600' :
    percent < 50 ? 'text-amber-600' :
    'text-emerald-600';

  return (
    <View className="bg-gray-50 rounded-xl p-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-medium text-gray-700">Lượt tạo hôm nay</Text>
        <Text className={`text-xs font-semibold ${textColor}`}>
          {remaining}/{limit} còn lại
        </Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </View>
      <Text className="text-xs text-gray-400 mt-1">{used}/{limit} lượt hôm nay</Text>
    </View>
  );
}
