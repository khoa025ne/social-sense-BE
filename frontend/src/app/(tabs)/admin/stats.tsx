import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCompareStats } from '@/features/admin/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { StatsCompareRequest } from '@/types/api';

type Period = 'day' | 'month' | 'quarter' | 'year';

const PERIOD_OPTIONS: { value: Period; label: string; placeholder: string }[] = [
  { value: 'day', label: 'Ngày', placeholder: 'YYYY-MM-DD' },
  { value: 'month', label: 'Tháng', placeholder: 'YYYY-MM' },
  { value: 'quarter', label: 'Quý', placeholder: 'YYYY-Q1' },
  { value: 'year', label: 'Năm', placeholder: 'YYYY' },
];

// ─── DiffBadge ────────────────────────────────────────────────────────────────

function DiffBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <View className={`px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
      <Text className={`text-xs font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
        {isPositive ? '+' : ''}{value.toFixed(1)}%
      </Text>
    </View>
  );
}

// ─── CompareRow ───────────────────────────────────────────────────────────────

function CompareRow({
  label,
  valueA,
  valueB,
  diffPercent,
}: {
  label: string;
  valueA: number;
  valueB: number;
  diffPercent?: number;
}) {
  return (
    <View className="flex-row items-center py-2.5 border-b border-gray-50">
      <Text className="text-xs text-gray-500 flex-1">{label}</Text>
      <Text className="text-sm font-semibold text-gray-800 w-16 text-right">{valueA}</Text>
      <Text className="text-sm font-semibold text-gray-800 w-16 text-right">{valueB}</Text>
      {diffPercent !== undefined && (
        <View className="w-20 items-end">
          <DiffBadge value={diffPercent} />
        </View>
      )}
    </View>
  );
}

// ─── StatsScreen ──────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');
  const [periodA, setPeriodA] = useState('');
  const [periodB, setPeriodB] = useState('');

  const { mutate: compare, isPending, data: result } = useCompareStats();

  const placeholder = PERIOD_OPTIONS.find((p) => p.value === period)?.placeholder ?? '';

  const handleCompare = useCallback(() => {
    if (!periodA.trim() || !periodB.trim()) return;
    compare({ period, periodA: periodA.trim(), periodB: periodB.trim() });
  }, [period, periodA, periodB, compare]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">So sánh thống kê</Text>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Period Type Selector */}
        <View className="mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Loại kỳ
          </Text>
          <View className="flex-row gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPeriod(opt.value)}
                className={`flex-1 py-2 rounded-xl border ${
                  period === opt.value
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-center text-xs font-medium ${
                    period === opt.value ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Period Inputs */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">Kỳ A</Text>
            <TextInput
              value={periodA}
              onChangeText={setPeriodA}
              placeholder={placeholder}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800"
              autoCapitalize="none"
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">Kỳ B</Text>
            <TextInput
              value={periodB}
              onChangeText={setPeriodB}
              placeholder={placeholder}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800"
              autoCapitalize="none"
            />
          </View>
        </View>

        <Button
          variant="primary"
          onPress={handleCompare}
          loading={isPending}
          disabled={!periodA.trim() || !periodB.trim()}
        >
          So sánh
        </Button>

        {/* Results */}
        {result && (
          <Card variant="outlined" className="mt-6">
            {/* Column headers */}
            <View className="flex-row items-center pb-2 border-b border-gray-100 mb-1">
              <Text className="text-xs text-gray-400 flex-1">Chỉ số</Text>
              <Text className="text-xs font-semibold text-gray-600 w-16 text-right">
                {result.periodA.label}
              </Text>
              <Text className="text-xs font-semibold text-gray-600 w-16 text-right">
                {result.periodB.label}
              </Text>
              <Text className="text-xs text-gray-400 w-20 text-right">Thay đổi</Text>
            </View>

            <CompareRow
              label="Người dùng mới"
              valueA={result.periodA.newUsers}
              valueB={result.periodB.newUsers}
              diffPercent={result.diff.newUsersChangePercent}
            />
            <CompareRow
              label="Người dùng hoạt động"
              valueA={result.periodA.activeUsers}
              valueB={result.periodB.activeUsers}
            />
            <CompareRow
              label="Nội dung đã tạo"
              valueA={result.periodA.totalContentGenerated}
              valueB={result.periodB.totalContentGenerated}
              diffPercent={result.diff.contentGeneratedChangePercent}
            />
            <CompareRow
              label="Tài liệu tham khảo mới"
              valueA={result.periodA.newKnowledgeItems}
              valueB={result.periodB.newKnowledgeItems}
            />
            <CompareRow
              label="Xu hướng mới"
              valueA={result.periodA.newTrends}
              valueB={result.periodB.newTrends}
            />
          </Card>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
