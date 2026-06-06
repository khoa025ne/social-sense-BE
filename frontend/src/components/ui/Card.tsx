import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, variant = 'default', className, ...props }: CardProps) {
  const variantClass = {
    default: 'bg-white dark:bg-gray-800 rounded-2xl p-4',
    elevated: 'bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md shadow-gray-200 dark:shadow-gray-900',
    outlined: 'bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700',
  }[variant];

  return (
    <View className={`${variantClass} ${className ?? ''}`} {...props}>
      {children}
    </View>
  );
}
