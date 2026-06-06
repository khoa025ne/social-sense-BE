import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin } from '@/features/auth/hooks';
import { AppLogo } from '@/components/ui/AppLogo';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: loginMutate, isPending } = useLogin();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutate(data, {
      onError: (err) => {
        const axiosError = err as AxiosError<ApiError>;
        const code = axiosError.response?.data?.code;
        if (code === 'AUTH_INVALID_CREDENTIALS') {
          setError('password', { message: 'Email hoặc mật khẩu không đúng' });
        }
      },
    });
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      <View className="flex-1 px-6 pt-16 pb-8">
        {/* Header */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 bg-primary-50 rounded-2xl items-center justify-center mb-4 border border-primary-100">
            <AppLogo size={44} color="#111827" />
          </View>
          <Text className="text-2xl font-bold text-gray-900">Chào mừng trở lại</Text>
          <Text className="text-gray-500 mt-1">Đăng nhập để tiếp tục</Text>
        </View>

        {/* Form */}
        <View className="gap-4">
          {/* Email */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`border rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 ${
                    errors.email ? 'border-red-400' : 'border-gray-200'
                  }`}
                  placeholder="email@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.email ? (
              <Text className="text-red-500 text-xs mt-1">{errors.email.message}</Text>
            ) : null}
          </View>

          {/* Password */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</Text>
            <View className="relative">
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`border rounded-xl px-4 py-3.5 pr-12 text-gray-900 bg-gray-50 ${
                      errors.password ? 'border-red-400' : 'border-gray-200'
                    }`}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              <TouchableOpacity
                className="absolute right-3 top-3.5"
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text className="text-gray-400 text-sm">{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <Text className="text-red-500 text-xs mt-1">{errors.password.message}</Text>
            ) : null}
          </View>

          {/* Submit */}
          <TouchableOpacity
            className="bg-primary-500 rounded-xl py-4 items-center mt-2"
            style={{ opacity: isPending ? 0.7 : 1 }}
            onPress={handleSubmit(onSubmit)}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white font-semibold text-base">Đăng nhập</Text>
            )}
          </TouchableOpacity>

          {/* Forgot password */}
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity className="items-center py-1">
              <Text className="text-primary-500 text-sm font-medium">Quên mật khẩu?</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Chưa có tài khoản? </Text>
          <Link href="/(auth)/register">
            <Text className="text-primary-500 font-semibold">Đăng ký</Text>
          </Link>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
