import React from 'react';
import { View, Text } from 'react-native';

interface TabBarIconProps {
  emoji: string;
  focused: boolean;
  badge?: number;
}

export function TabBarIcon({ emoji, focused, badge }: TabBarIconProps) {
  return (
    <View className="items-center justify-center">
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
      {badge !== undefined && badge > 0 && (
        <View className="absolute -top-1 -right-2 bg-red-500 rounded-full min-w-[16px] h-4 items-center justify-center px-1">
          <Text className="text-white text-[10px] font-bold">{badge}</Text>
        </View>
      )}
    </View>
  );
}
