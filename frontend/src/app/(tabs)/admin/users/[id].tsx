import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAdminUser,
  useUpdateUserTier,
  useResetUserQuota,
  useDeactivateUser,
  useRestoreUser,
} from '@/features/admin/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';

const TIERS = ['Free', 'Pro', 'Ultra'];

// ─── TierPickerModal ──────────────────────────────────────────────────────────

interface TierPickerModalProps {
  visible: boolean;
  currentTier: string;
  onSelect: (tier: string) => void;
  onClose: () => void;
}

function TierPickerModal({ visible, currentTier, onSelect, onClose }: TierPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/40 items-center justify-center"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="bg-white rounded-2xl w-72 overflow-hidden">
          <View className="px-4 py-3 border-b border-gray-100">
            <Text className="text-base font-semibold text-gray-900">Chọn gói dịch vụ</Text>
          </View>
          {TIERS.map((tier) => (
            <TouchableOpacity
              key={tier}
              onPress={() => onSelect(tier)}
              className={`px-4 py-3.5 border-b border-gray-50 flex-row items-center justify-between ${
                tier === currentTier ? 'bg-primary-50' : ''
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  tier === currentTier ? 'text-primary-600' : 'text-gray-800'
                }`}
              >
                {tier}
              </Text>
              {tier === currentTier && <Text className="text-primary-500">✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} className="px-4 py-3">
            <Text className="text-sm text-gray-500 text-center">Hủy</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-50">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="text-xs text-gray-800 font-medium flex-1 text-right ml-4" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── UserDetailContent ────────────────────────────────────────────────────────

function UserDetailContent({ userId }: { userId: number }) {
  const router = useRouter();

  const { data: user, isLoading } = useAdminUser(userId);
  const { mutate: updateTier, isPending: isUpdatingTier } = useUpdateUserTier();
  const { mutate: resetQuota, isPending: isResettingQuota } = useResetUserQuota();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateUser();
  const { mutate: restore, isPending: isRestoring } = useRestoreUser();

  const [showTierPicker, setShowTierPicker] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'success' });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => setToast((p) => ({ ...p, visible: false })), []);

  const handleTierSelect = useCallback(
    (tier: string) => {
      setShowTierPicker(false);
      updateTier(
        { id: userId, tier },
        {
          onSuccess: () => showToast(`Đã đổi sang gói ${tier}`),
          onError: () => showToast('Đổi gói thất bại', 'error'),
        }
      );
    },
    [userId, updateTier, showToast]
  );

  const handleResetQuota = useCallback(() => {
    Alert.alert('Reset quota', 'Xác nhận reset quota hôm nay?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () =>
          resetQuota(userId, {
            onSuccess: () => showToast('Đã reset quota'),
            onError: () => showToast('Reset thất bại', 'error'),
          }),
      },
    ]);
  }, [userId, resetQuota, showToast]);

  const handleToggleActive = useCallback(() => {
    if (!user) return;
    const action = user.isActive ? 'vô hiệu hóa' : 'khôi phục';
    Alert.alert(`Xác nhận ${action}`, `Bạn muốn ${action} tài khoản này?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        style: user.isActive ? 'destructive' : 'default',
        onPress: () => {
          if (user.isActive) {
            deactivate(userId, {
              onSuccess: () => showToast('Đã vô hiệu hóa tài khoản'),
              onError: () => showToast('Thao tác thất bại', 'error'),
            });
          } else {
            restore(userId, {
              onSuccess: () => showToast('Đã khôi phục tài khoản'),
              onError: () => showToast('Thao tác thất bại', 'error'),
            });
          }
        },
      },
    ]);
  }, [user, userId, deactivate, restore, showToast]);

  if (isLoading || !user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      <TierPickerModal
        visible={showTierPicker}
        currentTier={user.tier === 'Enterprise' ? 'Ultra' : user.tier}
        onSelect={handleTierSelect}
        onClose={() => setShowTierPicker(false)}
      />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 flex-1" numberOfLines={1}>
          {user.displayName}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info */}
        <Card variant="outlined" className="mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Thông tin tài khoản
          </Text>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Tên hiển thị" value={user.displayName} />
          <InfoRow label="Gói dịch vụ" value={user.tier === 'Enterprise' ? 'Ultra' : user.tier} />
          <InfoRow label="Trạng thái" value={user.isActive ? 'Hoạt động' : 'Vô hiệu hóa'} />
          <InfoRow label="Quota hôm nay" value={`${user.remainingQuota}/${user.dailyQuotaLimit}`} />
          <InfoRow label="Tổng nội dung" value={String(user.totalContentGenerated)} />
          <InfoRow label="Ngày tạo" value={new Date(user.createdAt).toLocaleDateString('vi-VN')} />
          <InfoRow label="Roles" value={user.roles.join(', ')} />
        </Card>

        {/* Actions */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Hành động
        </Text>

        <View className="gap-3">
          <Button
            variant="outline"
            onPress={() => setShowTierPicker(true)}
            loading={isUpdatingTier}
          >
            Đổi gói dịch vụ (hiện: {user.tier === 'Enterprise' ? 'Ultra' : user.tier})
          </Button>

          <Button variant="outline" onPress={handleResetQuota} loading={isResettingQuota}>
            🔄 Reset quota hôm nay
          </Button>

          <Button
            variant={user.isActive ? 'outline' : 'primary'}
            onPress={handleToggleActive}
            loading={isDeactivating || isRestoring}
          >
            {user.isActive ? '🚫 Vô hiệu hóa tài khoản' : '✅ Khôi phục tài khoản'}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Export default — guard wrapper ──────────────────────────────────────────

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);

  if (!id || isNaN(userId)) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">ID không hợp lệ</Text>
      </SafeAreaView>
    );
  }

  return <UserDetailContent userId={userId} />;
}
