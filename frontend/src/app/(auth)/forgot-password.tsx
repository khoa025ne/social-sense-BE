import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForgotPassword } from '@/features/auth/hooks';
import { AppLogo } from '@/components/ui/AppLogo';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

type FormData = z.infer<typeof schema>;

// ─── ForgotPasswordScreen ─────────────────────────────────────────────────────

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { mutate: sendOtp, isPending, isSuccess } = useForgotPassword();

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = (data: FormData) => {
    // BE luôn trả 200 dù email có tồn tại hay không
    // → không cần xử lý error riêng, chỉ navigate sang reset screen
    sendOtp(data, {
      onSuccess: () => {
        router.push({
          pathname: '/(auth)/reset-password',
          params: { email: data.email },
        });
      },
      onError: () => {
        // Network error hoặc 5xx — vẫn navigate để tránh leak thông tin
        router.push({
          pathname: '/(auth)/reset-password',
          params: { email: data.email },
        });
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
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-8 self-start"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-primary-500 font-medium">← Quay lại</Text>
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-8">
            <View className="w-20 h-20 bg-primary-50 rounded-2xl items-center justify-center mb-4 border border-primary-100">
              <AppLogo size={44} color="#111827" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">Quên mật khẩu?</Text>
            <Text className="text-gray-500 leading-5">
              Nhập email đăng ký của bạn. Chúng tôi sẽ gửi mã OTP 6 số để đặt lại mật khẩu.
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
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
                    autoFocus
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    returnKeyType="send"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                )}
              />
              {errors.email ? (
                <Text className="text-red-500 text-xs mt-1">{errors.email.message}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              className="bg-primary-500 rounded-xl py-4 items-center"
              style={{ opacity: isPending ? 0.7 : 1 }}
              onPress={handleSubmit(onSubmit)}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-semibold text-base">Gửi mã OTP</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Info note */}
          <View className="mt-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <Text className="text-xs text-blue-700 leading-4">
              💡 Vì lý do bảo mật, chúng tôi sẽ hiển thị thông báo gửi thành công dù email có tồn tại hay không.
            </Text>
          </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
