import { useEffect } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMe, useUpdateProfile } from '@/features/auth/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// ─── Validation Schema ────────────────────────────────────────────────────────

const schema = z.object({
  displayName: z
    .string()
    .min(2, 'Tên hiển thị phải có ít nhất 2 ký tự')
    .max(160, 'Tên hiển thị tối đa 160 ký tự')
    .trim(),
});

type FormValues = z.infer<typeof schema>;

// ─── EditProfileScreen ────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const { data: user } = useMe();
  const { mutate: doUpdate, isPending } = useUpdateProfile();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '' },
  });

  // Pre-fill form khi data user load xong
  useEffect(() => {
    if (user?.displayName) {
      reset({ displayName: user.displayName });
    }
  }, [user?.displayName, reset]);

  const onSubmit = (values: FormValues) => {
    doUpdate(
      { displayName: values.displayName },
      {
        onSuccess: (res) => {
          Alert.alert('Thành công', res.message, [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (err: any) => {
          const code = err?.response?.data?.code;
          if (code === 'INVALID_DISPLAY_NAME') {
            Alert.alert('Lỗi', 'Tên hiển thị không hợp lệ.');
          } else {
            Alert.alert('Lỗi', 'Không thể cập nhật thông tin. Vui lòng thử lại.');
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
        <Text className="text-lg font-semibold text-gray-900 flex-1">Chỉnh sửa thông tin</Text>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
          {/* Avatar + current info */}
          <Card variant="elevated" className="mb-6 items-center py-5">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-3">
              <MaterialIcons name="person" size={40} color="#374151" />
            </View>
            <Text className="text-sm text-gray-500">{user?.email ?? ''}</Text>
          </Card>

          {/* Form */}
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">
            Thông tin cá nhân
          </Text>

          {/* DisplayName field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị</Text>
            <Controller
              control={control}
              name="displayName"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Nhập tên hiển thị"
                  placeholderTextColor="#9CA3AF"
                  maxLength={160}
                  className={`bg-white border rounded-xl px-4 py-3.5 text-sm text-gray-900 ${
                    errors.displayName ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
              )}
            />
            {errors.displayName ? (
              <Text className="text-xs text-red-500 mt-1">{errors.displayName.message}</Text>
            ) : null}
          </View>

          {/* Email — readonly */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Email</Text>
            <View className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3.5 flex-row items-center">
              <Text className="text-sm text-gray-500 flex-1">{user?.email ?? ''}</Text>
              <Text className="text-xs text-gray-400">Không thể thay đổi</Text>
            </View>
          </View>

          {/* Submit */}
          <View className="mt-2">
            <Button
              variant="primary"
              onPress={handleSubmit(onSubmit)}
              loading={isPending}
              disabled={!isDirty}
            >
              Lưu thay đổi
            </Button>
          </View>
        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
