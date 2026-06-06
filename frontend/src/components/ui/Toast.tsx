import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide?: () => void;
  duration?: number;
}

const typeConfig: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: { bg: 'bg-emerald-500', text: 'text-white', icon: '✓' },
  error: { bg: 'bg-red-500', text: 'text-white', icon: '✕' },
  info: { bg: 'bg-primary-500', text: 'text-white', icon: 'ℹ' },
};

export function Toast({
  message,
  type = 'success',
  visible,
  onHide,
  duration = 2000,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const config = typeConfig[type];

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, onHide, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{ transform: [{ translateY }] }}
      className={`absolute top-12 left-4 right-4 z-50 ${config.bg} rounded-xl px-4 py-3 flex-row items-center shadow-lg`}
    >
      <Text className={`${config.text} font-bold mr-2`}>{config.icon}</Text>
      <Text className={`${config.text} font-medium flex-1`}>{message}</Text>
    </Animated.View>
  );
}
