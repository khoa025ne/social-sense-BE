import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useResetPassword, useForgotPassword } from '@/features/auth/hooks';
import { AppLogo } from '@/components/ui/AppLogo';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const OTP_EXPIRE_SECONDS = 10 * 60; // 10 phút
const RESEND_COOLDOWN_SECONDS = 60;  // 60 giây trước khi cho phép gửi lại

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    newPassword: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

// ─── OtpInput ─────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string[];
  onChange: (digits: string[]) => void;
  hasError: boolean;
}

function OtpInput({ value, onChange, hasError }: OtpInputProps) {
  const refs = useRef<Array<TextInput | null>>([]);

  const handleChange = (text: string, index: number) => {
    // Chỉ nhận ký tự số
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);

    // Auto-focus ô tiếp theo
    if (digit && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    // Backspace trên ô rỗng → focus ô trước
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View className="flex-row justify-between" style={{ gap: 8 }}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          value={value[i] ?? ''}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
          className={`flex-1 h-14 rounded-xl border text-xl font-bold text-gray-900 bg-gray-50 ${
            hasError
              ? 'border-red-400 bg-red-50'
              : value[i]
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-200'
          }`}
        />
      ))}
    </View>
  );
}

// ─── CountdownTimer ───────────────────────────────────────────────────────────

interface CountdownTimerProps {
  seconds: number;
}

function CountdownTimer({ seconds }: CountdownTimerProps) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isUrgent = seconds <= 60;

  return (
    <View className="flex-row items-center justify-center" style={{ gap: 4 }}>
      <Text className="text-xs text-gray-400">Mã hết hạn sau</Text>
      <Text
        className={`text-xs font-bold tabular-nums ${
          isUrgent ? 'text-red-500' : 'text-gray-600'
        }`}
      >
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
}

// ─── ResetPasswordScreen ──────────────────────────────────────────────────────

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  // OTP digits state — 6 ô riêng biệt
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Countdown: OTP expire (10 phút)
  const [expireSeconds, setExpireSeconds] = useState(OTP_EXPIRE_SECONDS);
  const expireRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resend cooldown (60 giây)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutate: resetMutate, isPending: isResetting } = useResetPassword();
  const { mutate: resendOtp, isPending: isResending } = useForgotPassword();

  // ── Start expire countdown on mount ──────────────────────────────────────
  useEffect(() => {
    expireRef.current = setInterval(() => {
      setExpireSeconds((s) => {
        if (s <= 1) {
          clearInterval(expireRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(expireRef.current!);
  }, []);

  // ── Start resend cooldown on mount ────────────────────────────────────────
  useEffect(() => {
    resendRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(resendRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(resendRef.current!);
  }, []);

  // ── Password form ─────────────────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleResend = useCallback(() => {
    if (!email || resendCooldown > 0 || isResending) return;

    resendOtp(
      { email },
      {
        onSuccess: () => {
          // Reset cả 2 countdown
          setExpireSeconds(OTP_EXPIRE_SECONDS);
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
          setOtpDigits(Array(OTP_LENGTH).fill(''));
          setOtpError('');

          // Restart expire timer
          clearInterval(expireRef.current!);
          expireRef.current = setInterval(() => {
            setExpireSeconds((s) => {
              if (s <= 1) { clearInterval(expireRef.current!); return 0; }
              return s - 1;
            });
          }, 1000);

          // Restart resend cooldown
          clearInterval(resendRef.current!);
          resendRef.current = setInterval(() => {
            setResendCooldown((s) => {
              if (s <= 1) { clearInterval(resendRef.current!); return 0; }
              return s - 1;
            });
          }, 1000);
        },
      }
    );
  }, [email, resendCooldown, isResending, resendOtp]);

  const onSubmit = useCallback(
    (formData: FormData) => {
      const otpCode = otpDigits.join('');

      // Client-side validation trước khi gọi API
      if (otpCode.length < OTP_LENGTH) {
        setOtpError('Vui lòng nhập đủ 6 số OTP');
        return;
      }
      if (expireSeconds === 0) {
        setOtpError('Mã OTP đã hết hạn. Vui lòng gửi lại.');
        return;
      }

      setOtpError('');

      resetMutate(
        {
          email: email ?? '',
          otpCode,
          newPassword: formData.newPassword,
        },
        {
          // onSuccess → hook tự xử lý: clearTokens + clearAuth + navigate login
          onError: (err) => {
            const axiosError = err as AxiosError<ApiError>;
            const code = axiosError.response?.data?.code;

            if (code === 'OTP_INVALID_OR_EXPIRED') {
              setOtpError('Mã OTP không hợp lệ hoặc đã hết hạn');
              // Clear OTP để user nhập lại
              setOtpDigits(Array(OTP_LENGTH).fill(''));
            } else if (code === 'USER_NOT_FOUND') {
              // Email không tồn tại — quay về forgot password
              router.replace('/(auth)/forgot-password');
            } else {
              setOtpError('Đặt lại mật khẩu thất bại, thử lại sau');
            }
          },
        }
      );
    },
    [otpDigits, expireSeconds, email, resetMutate, router]
  );

  const isOtpExpired = expireSeconds === 0;
  const canResend = resendCooldown === 0 && !isResending;
  const otpComplete = otpDigits.every((d) => d !== '');

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
          <View className="mb-6">
            <View className="w-16 h-16 bg-primary-50 rounded-2xl items-center justify-center mb-4 border border-primary-100">
              <AppLogo size={36} color="#111827" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">Kiểm tra email</Text>
            <Text className="text-gray-500 leading-5">
              Chúng tôi đã gửi mã OTP 6 số đến{' '}
              <Text className="font-semibold text-gray-700">{email}</Text>
            </Text>
          </View>

          {/* OTP Section */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-medium text-gray-700">Mã OTP</Text>
              {!isOtpExpired && <CountdownTimer seconds={expireSeconds} />}
            </View>

            <OtpInput
              value={otpDigits}
              onChange={(digits) => {
                setOtpDigits(digits);
                if (otpError) setOtpError('');
              }}
              hasError={!!otpError}
            />

            {/* OTP error */}
            {otpError ? (
              <Text className="text-red-500 text-xs mt-2">{otpError}</Text>
            ) : null}

            {/* OTP expired warning */}
            {isOtpExpired && (
              <View className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <Text className="text-xs text-red-600 font-medium">
                  ⏰ Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.
                </Text>
              </View>
            )}

            {/* Resend OTP */}
            <View className="flex-row items-center justify-center mt-3" style={{ gap: 4 }}>
              <Text className="text-xs text-gray-400">Không nhận được mã?</Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResend} disabled={isResending}>
                  {isResending ? (
                    <ActivityIndicator size="small" color="#111827" />
                  ) : (
                    <Text className="text-xs text-primary-500 font-semibold">Gửi lại OTP</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <Text className="text-xs text-gray-400">
                  Gửi lại sau{' '}
                  <Text className="font-semibold tabular-nums">{resendCooldown}s</Text>
                </Text>
              )}
            </View>
          </View>

          {/* Divider */}
          <View className="h-px bg-gray-100 mb-6" />

          {/* Password fields */}
          <View className="gap-4">
            {/* New password */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</Text>
              <View className="relative">
                <Controller
                  control={control}
                  name="newPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={`border rounded-xl px-4 py-3.5 pr-12 text-gray-900 bg-gray-50 ${
                        errors.newPassword ? 'border-red-400' : 'border-gray-200'
                      }`}
                      placeholder="Tối thiểu 6 ký tự"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                <TouchableOpacity
                  className="absolute right-3 top-3.5"
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-gray-400 text-sm">{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {errors.newPassword ? (
                <Text className="text-red-500 text-xs mt-1">{errors.newPassword.message}</Text>
              ) : null}
            </View>

            {/* Confirm password */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu</Text>
              <View className="relative">
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={`border rounded-xl px-4 py-3.5 pr-12 text-gray-900 bg-gray-50 ${
                        errors.confirmPassword ? 'border-red-400' : 'border-gray-200'
                      }`}
                      placeholder="Nhập lại mật khẩu mới"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showConfirm}
                      autoComplete="new-password"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                  )}
                />
                <TouchableOpacity
                  className="absolute right-3 top-3.5"
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-gray-400 text-sm">{showConfirm ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? (
                <Text className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</Text>
              ) : null}
            </View>

            {/* Submit */}
            <TouchableOpacity
              className={`rounded-xl py-4 items-center mt-2 ${
                otpComplete && !isOtpExpired && !isResetting
                  ? 'bg-primary-500'
                  : 'bg-gray-200'
              }`}
              style={{ opacity: isResetting ? 0.7 : 1 }}
              onPress={handleSubmit(onSubmit)}
              disabled={isResetting || isOtpExpired}
            >
              {isResetting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  className={`font-semibold text-base ${
                    otpComplete && !isOtpExpired ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  Đặt lại mật khẩu
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Security note */}
          <View className="mt-6 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <Text className="text-xs text-amber-700 leading-4">
              🔒 Sau khi đặt lại thành công, bạn sẽ bị đăng xuất khỏi tất cả thiết bị.
            </Text>
          </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
