import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRegister } from '@/features/auth/hooks';
import { AppLogo } from '@/components/ui/AppLogo';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

const registerSchema = z.object({
  displayName: z.string().min(2, 'Tên hiển thị tối thiểu 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .regex(/[A-Z]/, 'Cần ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Cần ít nhất 1 chữ số'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { mutate: registerMutate, isPending } = useRegister();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutate(data, {
      onSuccess: () => {
        router.replace('/(auth)/login');
      },
      onError: (err) => {
        const axiosError = err as AxiosError<ApiError>;
        const code = axiosError.response?.data?.code;
        if (code === 'AUTH_EMAIL_EXISTS') {
          setError('email', { message: 'Email đã được đăng ký' });
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
            <Text className="text-2xl font-bold text-gray-900">Tạo tài khoản</Text>
            <Text className="text-gray-500 mt-1">Bắt đầu tạo nội dung AI ngay hôm nay</Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            {/* Display Name */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị</Text>
              <Controller
                control={control}
                name="displayName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`border rounded-xl px-4 py-3.5 text-gray-900 bg-gray-50 ${
                      errors.displayName ? 'border-red-400' : 'border-gray-200'
                    }`}
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.displayName ? (
                <Text className="text-red-500 text-xs mt-1">{errors.displayName.message}</Text>
              ) : null}
            </View>

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
                      placeholder="Tối thiểu 8 ký tự, 1 chữ hoa, 1 số"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPassword}
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
                <Text className="text-white font-semibold text-base">Đăng ký</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Đã có tài khoản? </Text>
            <Link href="/(auth)/login">
              <Text className="text-primary-500 font-semibold">Đăng nhập</Text>
            </Link>
          </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
