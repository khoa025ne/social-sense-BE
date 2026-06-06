import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonLoaderProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any, // RN accepts string percentages at runtime
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3">
      <SkeletonLoader height={16} width="60%" borderRadius={8} style={{ marginBottom: 8 }} />
      <SkeletonLoader height={12} width="100%" borderRadius={6} style={{ marginBottom: 6 }} />
      <SkeletonLoader height={12} width="80%" borderRadius={6} style={{ marginBottom: 12 }} />
      <View className="flex-row gap-2">
        <SkeletonLoader height={24} width={60} borderRadius={12} />
        <SkeletonLoader height={24} width={60} borderRadius={12} />
      </View>
    </View>
  );
}
