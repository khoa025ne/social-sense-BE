import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useCreateOrder, useOrderStatus } from '@/features/payment/hooks';
import { useMe } from '@/features/auth/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Config } from '@/constants/config';
import type { PaymentTier } from '@/types/api';
import { differenceInSeconds } from 'date-fns';

// ─── Countdown Timer ──────────────────────────────────────────────────────────

interface CountdownProps {
  expiresAt: string;
  onExpired: () => void;
}

function Countdown({ expiresAt, onExpired }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const seconds = differenceInSeconds(expiry, now);
      return Math.max(0, seconds);
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const left = calculateTimeLeft();
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(interval);
        onExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-center">
      <Text className="text-amber-700 text-sm mr-2">⏰</Text>
      <Text className="text-amber-700 text-sm font-medium">
        Hết hạn sau: {minutes}:{seconds.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

// ─── CheckoutScreen ───────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const { tier } = useLocalSearchParams<{ tier: string }>();
  const router = useRouter();
  const { mutate: createMutate, isPending: isCreating } = useCreateOrder();
  const { refetch: refetchMe } = useMe();

  const [orderCode, setOrderCode] = useState<number | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ visible: true, message, type });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // Polling order status
  const { data: orderStatus } = useOrderStatus(orderCode, pollingEnabled);

  // Tạo order khi mount
  useEffect(() => {
    if (!tier) return;

    createMutate(
      { tier: tier as PaymentTier },
      {
        onSuccess: (data) => {
          setOrderData(data);
          setOrderCode(data.orderCode);
          setPollingEnabled(true);
          setPollingStartTime(Date.now());
        },
        onError: () => {
          showToast('Tạo đơn hàng thất bại', 'error');
          router.navigate('/(tabs)/profile/payment/plans' as any);
        },
      }
    );
  }, [tier, createMutate, router, showToast]);

  // Xử lý khi order status thay đổi
  useEffect(() => {
    if (!orderStatus) return;

    if (orderStatus.status === 'Paid') {
      setPollingEnabled(false);
      showToast('Thanh toán thành công! 🎉', 'success');
      setTimeout(async () => {
        await refetchMe();
        router.replace('/(tabs)' as any);
      }, 2000);
    } else if (orderStatus.status === 'Cancelled' || orderStatus.status === 'Expired') {
      setPollingEnabled(false);
      showToast(`Đơn hàng đã ${orderStatus.status === 'Cancelled' ? 'bị hủy' : 'hết hạn'}`, 'error');
    }
  }, [orderStatus, showToast, refetchMe, router]);

  // Auto-stop polling sau 10 phút
  useEffect(() => {
    if (!pollingStartTime || !pollingEnabled) return;

    const checkTimeout = setInterval(() => {
      const elapsed = Date.now() - pollingStartTime;
      if (elapsed >= Config.QUERY.PAYMENT_POLL_TIMEOUT) {
        setPollingEnabled(false);
        showToast('Hết thời gian chờ thanh toán', 'error');
      }
    }, 5000);

    return () => clearInterval(checkTimeout);
  }, [pollingStartTime, pollingEnabled, showToast]);

  const handleCopyDescription = useCallback(async () => {
    if (!orderData?.bankTransfer?.description) return;
    await Clipboard.setStringAsync(orderData.bankTransfer.description);
    showToast('Đã sao chép nội dung chuyển khoản');
  }, [orderData, showToast]);

  const handleExpired = useCallback(() => {
    setPollingEnabled(false);
    Alert.alert('Hết hạn', 'Đơn hàng đã hết hạn. Vui lòng tạo đơn mới.', [
      { text: 'OK', onPress: () => router.navigate('/(tabs)/profile/payment/plans' as any) },
    ]);
  }, [router]);

  if (isCreating || !orderData) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#111827" />
          <Text className="text-gray-500 mt-4">Đang tạo đơn hàng...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/profile/payment/plans' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Thanh toán</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Countdown */}
        <View className="mb-4">
          <Countdown expiresAt={orderData.expiresAt} onExpired={handleExpired} />
        </View>

        {/* QR Code */}
        <Card variant="elevated" className="mb-4 items-center">
          <Text className="text-base font-semibold text-gray-900 mb-3">Quét mã QR để thanh toán</Text>
          <Image
            source={{ uri: orderData.qrCodeUrl }}
            style={{ width: 250, height: 250 }}
            contentFit="contain"
          />
        </Card>

        {/* Bank Transfer Info */}
        <Card variant="outlined" className="mb-4">
          <Text className="text-base font-semibold text-gray-900 mb-3">
            Hoặc chuyển khoản thủ công
          </Text>

          <View className="mb-3">
            <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ngân hàng</Text>
            <Text className="text-sm text-gray-800 font-medium">
              {orderData.bankTransfer.bankName}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">Số tài khoản</Text>
            <Text className="text-sm text-gray-800 font-medium">
              {orderData.bankTransfer.accountNumber}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">Chủ tài khoản</Text>
            <Text className="text-sm text-gray-800 font-medium">
              {orderData.bankTransfer.accountName}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">Số tiền</Text>
            <Text className="text-lg text-primary-600 font-bold">
              {orderData.bankTransfer.amount.toLocaleString('vi-VN')} đ
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Nội dung chuyển khoản
            </Text>
            <View className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Text className="text-sm text-amber-900 font-bold">
                {orderData.bankTransfer.description}
              </Text>
            </View>
          </View>

          <Button variant="outline" onPress={handleCopyDescription}>
            📋 Sao chép nội dung
          </Button>
        </Card>

        {/* Status */}
        {pollingEnabled && (
          <View className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#3B82F6" className="mr-2" />
              <Text className="text-sm text-blue-700">Đang chờ xác nhận thanh toán...</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
