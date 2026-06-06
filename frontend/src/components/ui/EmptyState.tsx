import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, iconName, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      {iconName ? (
        <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
          <MaterialIcons name={iconName} size={32} color="#6B7280" />
        </View>
      ) : icon ? (
        <Text className="text-5xl mb-4">{icon}</Text>
      ) : null}
      <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100 text-center mb-2">{title}</Text>
      {description ? (
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="primary" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
