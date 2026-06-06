import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePaymentPlans } from '@/features/payment/hooks';
import { useMe } from '@/features/auth/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { PaymentPlan } from '@/types/api';

// ─── PlanCard ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: PaymentPlan;
  currentTier: string;
  onUpgrade: () => void;
}

function PlanCard({ plan, currentTier, onUpgrade }: PlanCardProps) {
  // Normalize cả 2 phía: Enterprise → Ultra để so sánh đúng
  const normalizedPlanTier = plan.tier === 'Enterprise' ? 'Ultra' : plan.tier;
  const normalizedCurrentTier = currentTier === 'Enterprise' ? 'Ultra' : currentTier;

  const isCurrent = normalizedPlanTier === normalizedCurrentTier;
  const isFree = normalizedPlanTier === 'Free';

  const tierColors: Record<string, { bg: string; border: string; text: string }> = {
    Free:  { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-700'   },
    Pro:   { bg: 'bg-primary-50', border: 'border-primary-500', text: 'text-primary-700' },
    Ultra: { bg: 'bg-amber-50',   border: 'border-amber-500',  text: 'text-amber-700'  },
  };

  const colors = tierColors[normalizedPlanTier] ?? tierColors.Free;
  const displayTier = normalizedPlanTier; // luôn hiển thị "Ultra", không bao giờ "Enterprise"

  return (
    <Card
      variant="outlined"
      className={`mb-4 ${isCurrent ? `${colors.bg} ${colors.border} border-2` : ''}`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className={`text-xl font-bold ${colors.text}`}>{displayTier}</Text>
          {isCurrent && (
            <View className="bg-green-100 px-2 py-0.5 rounded-full mt-1">
              <Text className="text-xs text-green-700 font-medium">Gói hiện tại</Text>
            </View>
          )}
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold text-gray-900">
            {plan.price === 0 ? 'Miễn phí' : `${plan.price.toLocaleString('vi-VN')}đ`}
          </Text>
          {plan.price > 0 && (
            <Text className="text-xs text-gray-500">{plan.billingCycle}</Text>
          )}
        </View>
      </View>

      {/* Features */}
      <View className="mb-4">
        {plan.features.map((feature, idx) => (
          <View key={idx} className="flex-row items-start mb-2">
            <Text className="text-green-500 mr-2">✓</Text>
            <Text className="text-sm text-gray-700 flex-1">{feature}</Text>
          </View>
        ))}
      </View>

      {/* Action button */}
      {!isFree && !isCurrent && (
        <Button variant="primary" onPress={onUpgrade}>
          Nâng cấp ngay
        </Button>
      )}
      {isCurrent && !isFree && (
        <Button variant="outline" disabled>
          Đang sử dụng
        </Button>
      )}
    </Card>
  );
}

// ─── PlansScreen ──────────────────────────────────────────────────────────────

export default function PlansScreen() {
  const router = useRouter();
  const { data: plans, isLoading: plansLoading } = usePaymentPlans();
  const { data: user } = useMe();

  const handleUpgrade = (tier: string) => {
    router.push({
      pathname: '/(tabs)/profile/payment/checkout',
      params: { tier },
    } as any);
  };

  if (plansLoading) {
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
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/profile/subscription' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Gói dịch vụ</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-sm text-gray-600 mb-6 text-center">
          Chọn gói phù hợp với nhu cầu của bạn
        </Text>

        {plans?.plans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            currentTier={user?.tier ?? 'Free'}
            onUpgrade={() => handleUpgrade(plan.tier)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
