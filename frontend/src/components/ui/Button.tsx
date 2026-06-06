import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gray-900 border border-gray-900',
  secondary: 'bg-gray-100 border border-gray-100',
  outline: 'bg-transparent border border-gray-900',
  ghost: 'bg-transparent border border-transparent',
};

const textStyles: Record<ButtonVariant, string> = {
  primary: 'text-white font-semibold',
  secondary: 'text-gray-800 font-semibold',
  outline: 'text-gray-900 font-semibold',
  ghost: 'text-gray-900 font-medium',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-4 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-xl',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${className ?? ''}`}
      style={{ opacity: isDisabled ? 0.5 : 1 }}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : '#111827'}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <Text className={`${textStyles[variant]} ${textSizeStyles[size]}`}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}
