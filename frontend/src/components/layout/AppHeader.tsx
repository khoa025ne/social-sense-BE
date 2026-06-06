/**
 * AppHeader — Header chuẩn cho các màn hình tab chính.
 * Hiển thị logo SocialSense bên trái + title + optional right slot.
 *
 * Usage:
 *   <AppHeader title="Trang chủ" />
 *   <AppHeader title="Xu hướng" rightSlot={<QuotaBadge />} />
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLogo } from '@/components/ui/AppLogo';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export function AppHeader({ title, subtitle, rightSlot }: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="px-5 pb-3 border-b bg-white border-gray-100"
    >
      <View className="flex-row items-center justify-between">
        {/* Left: logo + title */}
        <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
          <AppLogo size={28} color="#111827" />
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-xs text-gray-400" numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        {/* Right slot */}
        {rightSlot ? <View>{rightSlot}</View> : null}
      </View>
    </View>
  );
}
