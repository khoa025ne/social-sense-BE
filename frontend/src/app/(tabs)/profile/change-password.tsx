import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useChangePassword } from '@/features/auth/hooks';
import { Button } from '@/components/ui/Button';

// ─── Validation Schema ────────────────────────────────────────────────────────

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

// ─── PasswordField ────────────────────────────────────────────────────────────

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
}

function PasswordField({ label, value, onChangeText, error, placeholder }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1.5">{label}</Text>
      <View
        className={`flex-row items-center bg-white border rounded-xl px-4 ${
          error ? 'border-red-400' : 'border-gray-200'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 py-3.5 text-sm text-gray-900"
        />
        <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-gray-400 text-base">{visible ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}

// ─── ChangePasswordScreen ─────────────────────────────────────────────────────

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { mutate: doChangePassword, isPending } = useChangePassword();

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    doChangePassword(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          // useChangePassword sẽ tự logout và redirect về login
          Alert.alert(
            'Đổi mật khẩu thành công',
            'Vui lòng đăng nhập lại bằng mật khẩu mới.',
            [{ text: 'OK' }]
          );
        },
        onError: (err: any) => {
          const code = err?.response?.data?.code;
          if (code === 'AUTH_WRONG_PASSWORD') {
            setError('currentPassword', {
              message: 'Mật khẩu hiện tại không đúng',
            });
          } else if (code === 'AUTH_SAME_PASSWORD') {
            setError('newPassword', {
              message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại',
            });
          } else {
            Alert.alert('Lỗi', 'Không thể đổi mật khẩu. Vui lòng thử lại.');
          }
        },
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/profile' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 flex-1">Đổi mật khẩu</Text>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
          {/* Info Banner */}
          <View className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-6">
            <Text className="text-sm text-primary-700 leading-5">
              🔒 Sau khi đổi mật khẩu thành công, bạn sẽ được đăng xuất và cần đăng nhập lại bằng mật khẩu mới.
            </Text>
          </View>

          {/* Form */}
          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { value, onChange } }) => (
              <PasswordField
                label="Mật khẩu hiện tại"
                value={value}
                onChangeText={onChange}
                error={errors.currentPassword?.message}
                placeholder="Nhập mật khẩu hiện tại"
              />
            )}
          />

          {/* Divider */}
          <View className="h-px bg-gray-100 my-2 mb-4" />

          <Controller
            control={control}
            name="newPassword"
            render={({ field: { value, onChange } }) => (
              <PasswordField
                label="Mật khẩu mới"
                value={value}
                onChangeText={onChange}
                error={errors.newPassword?.message}
                placeholder="Tối thiểu 6 ký tự"
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { value, onChange } }) => (
              <PasswordField
                label="Xác nhận mật khẩu mới"
                value={value}
                onChangeText={onChange}
                error={errors.confirmPassword?.message}
                placeholder="Nhập lại mật khẩu mới"
              />
            )}
          />

          {/* Submit */}
          <View className="mt-4">
            <Button
              variant="primary"
              onPress={handleSubmit(onSubmit)}
              loading={isPending}
            >
              Đổi mật khẩu
            </Button>
          </View>
        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
