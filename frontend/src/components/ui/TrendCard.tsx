import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { TrendItem } from '@/types/api';

interface TrendCardProps {
  trend: TrendItem;
  onGeneratePress: (trendId: number) => void;
}

function getHotLevelConfig(level: number) {
  if (level >= 8) {
    return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', label: `HOT ${level}` };
  }
  if (level >= 5) {
    return { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-200', label: `${level}` };
  }
  return { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: `${level}` };
}

export function TrendCard({ trend, onGeneratePress }: TrendCardProps) {
  const hotConfig = getHotLevelConfig(trend.hotLevel);

  return (
    <View
      className="bg-white border border-gray-100 rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
    >
      {/* Hot level badge — style đồng bộ */}
      <View className={`self-start px-2.5 py-1 rounded-full border mb-2 ${hotConfig.bg} ${hotConfig.border}`}>
        <Text className={`text-xs font-semibold ${hotConfig.text}`}>
          {hotConfig.label}
        </Text>
      </View>

      {/* Title */}
      <Text className="text-base font-semibold text-gray-900 mb-1" numberOfLines={2}>
        {trend.title}
      </Text>

      {/* Summary */}
      <Text className="text-sm text-gray-500 mb-3" numberOfLines={2}>
        {trend.summary}
      </Text>

      {/* Tags + Action button */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row flex-wrap flex-1 mr-2" style={{ gap: 4 }}>
          {trend.tags.slice(0, 3).map((tag) => (
            <View key={tag.id} className="bg-gray-100 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-gray-600 font-medium">{tag.name}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          className="bg-gray-900 px-3 py-2 rounded-xl"
          onPress={() => onGeneratePress(trend.id)}
          activeOpacity={0.8}
        >
          <Text className="text-white text-xs font-semibold">Tạo →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
