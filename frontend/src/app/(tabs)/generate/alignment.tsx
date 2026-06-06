import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useCheckAlignment } from '@/features/content/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';

// ─── Score Gauge ──────────────────────────────────────────────────────────────

interface ScoreGaugeProps {
  score: number; // 0–100
}

function ScoreGauge({ score }: ScoreGaugeProps) {
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getColor = () => {
    if (score <= 40) return '#EF4444'; // red
    if (score <= 70) return '#F59E0B'; // yellow
    return '#10B981'; // green
  };

  const getLabel = () => {
    if (score <= 40) return 'Cần cải thiện';
    if (score <= 70) return 'Khá tốt';
    return 'Xuất sắc';
  };

  const color = getColor();

  return (
    <View className="items-center">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {/* Score text overlay */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 32, fontWeight: '800', color }}>{score}</Text>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>/ 100</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '600', color, marginTop: 6 }}>{getLabel()}</Text>
    </View>
  );
}

// ─── AlignmentScreen ──────────────────────────────────────────────────────────

export default function AlignmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefill?: string }>();

  const [draft, setDraft] = useState(params.prefill ?? '');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });

  const { mutate: checkMutate, isPending, data: result, reset } = useCheckAlignment();

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ visible: true, message, type });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCheck = useCallback(() => {
    if (!draft.trim()) {
      showToast('Vui lòng nhập nội dung cần kiểm tra', 'error');
      return;
    }
    checkMutate(
      { draftContent: draft.trim() },
      {
        onError: () => showToast('Kiểm tra thất bại, thử lại sau', 'error'),
      }
    );
  }, [draft, checkMutate, showToast]);

  const handleCopyRefined = useCallback(async () => {
    if (!result?.refinedContent) return;
    await Clipboard.setStringAsync(result.refinedContent);
    showToast('Đã sao chép bản tối ưu');
  }, [result, showToast]);

  const handleReset = useCallback(() => {
    reset();
    setDraft('');
  }, [reset]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/generate/result' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">Brand Alignment</Text>
          <Text className="text-xs text-gray-400">Kiểm tra độ phù hợp thương hiệu</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Input section */}
        {!result ? (
          <View>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Nội dung cần kiểm tra
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Dán nội dung bài đăng của bạn vào đây..."
              multiline
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 mb-4"
              style={{ textAlignVertical: 'top', minHeight: 180 }}
            />
            <Button variant="primary" onPress={handleCheck} loading={isPending}>
              {isPending ? 'Đang phân tích...' : 'Kiểm tra độ phù hợp'}
            </Button>
          </View>
        ) : (
          <View>
            {/* Score Gauge */}
            <Card variant="elevated" className="mb-4 items-center py-6">
              <ScoreGauge score={result.brandScore} />
            </Card>

            {/* Analysis */}
            <Card variant="outlined" className="mb-4">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Phân tích
              </Text>
              <Text className="text-sm text-gray-800 leading-5">{result.analysis}</Text>
            </Card>

            {/* Suggestions */}
            {result.suggestions && (
              <Card variant="outlined" className="mb-4">
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Gợi ý cải thiện
                </Text>
                <Text className="text-sm text-gray-800 leading-5">{result.suggestions}</Text>
              </Card>
            )}

            {/* Refined Content */}
            {result.refinedContent && (
              <Card variant="outlined" className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Bản viết lại tối ưu
                  </Text>
                  <TouchableOpacity onPress={handleCopyRefined}>
                    <Text className="text-xs text-primary-500 font-medium">Sao chép</Text>
                  </TouchableOpacity>
                </View>
                <View className="bg-gray-50 rounded-xl p-3">
                  <Text className="text-sm text-gray-800 leading-5">{result.refinedContent}</Text>
                </View>
                <View className="mt-3">
                  <Button variant="primary" onPress={handleCopyRefined}>
                    Dùng bản viết lại
                  </Button>
                </View>
              </Card>
            )}

            {/* Reset */}
            <Button variant="outline" onPress={handleReset}>
              Kiểm tra nội dung khác
            </Button>
          </View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
