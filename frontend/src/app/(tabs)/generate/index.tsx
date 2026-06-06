import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useGenerateContent } from '@/features/content/hooks';
import { useContentStore } from '@/features/content/store';
import { useTrends } from '@/features/trends/hooks';
import type { ContentMode, TrendItem } from '@/types/api';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

const PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'Zalo', 'LinkedIn'];
const OUTPUT_COUNTS = [1, 2, 3] as const;

export default function GenerateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trendId?: string }>();

  // Mode selector
  const [mode, setMode] = useState<ContentMode>('TrendBased');

  // TrendBased state
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null);
  const [showTrendPicker, setShowTrendPicker] = useState(false);
  const [trendSearch, setTrendSearch] = useState('');

  // Shared state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Facebook']);
  const [outputCount, setOutputCount] = useState<1 | 2 | 3>(1);
  const [userInstruction, setUserInstruction] = useState('');

  // Quota exceeded bottom sheet
  const quotaSheetRef = useRef<BottomSheet>(null);

  const { mutate: generate, isPending } = useGenerateContent();
  const { generatedItems } = useContentStore();

  // Trends data cho picker
  const { data: trendsData } = useTrends();
  const allTrends: TrendItem[] = trendsData?.pages.flatMap((p) => p.items) ?? [];
  const filteredTrends = allTrends.filter((t) =>
    t.title.toLowerCase().includes(trendSearch.toLowerCase())
  );

  // Pre-fill trendId nếu navigate từ Trend Feed
  React.useEffect(() => {
    if (params.trendId) {
      const found = allTrends.find((t) => String(t.id) === params.trendId);
      if (found) setSelectedTrend(found);
    }
  }, [params.trendId, allTrends]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleGenerate = useCallback(() => {
    if (selectedPlatforms.length === 0) return;
    if (mode === 'TrendBased' && !selectedTrend) return;

    generate(
      {
        outputCount,
        language: 'vi',
        targetPlatforms: selectedPlatforms,
        generateImage: false,
        mode,
        trendId: mode === 'TrendBased' ? selectedTrend?.id : undefined,
        userInstruction: userInstruction.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.push('/(tabs)/generate/result');
        },
        onError: (err) => {
          const axiosError = err as AxiosError<ApiError>;
          if (axiosError.response?.status === 429) {
            quotaSheetRef.current?.expand();
          }
        },
      }
    );
  }, [mode, selectedTrend, selectedPlatforms, outputCount, userInstruction, generate, router]);

  const canGenerate =
    selectedPlatforms.length > 0 &&
    (mode === 'PersonaDriven' || selectedTrend !== null);

  return (
    <>
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        <View className="px-5 pt-14 pb-4">
          <Text className="text-2xl font-bold text-gray-900">Tạo nội dung</Text>
          <Text className="text-sm text-gray-500 mt-0.5">AI sẽ tạo bài đăng phù hợp với thương hiệu của bạn</Text>
        </View>

        {/* Mode Selector */}
        <View className="px-5 mb-5">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Chế độ tạo nội dung</Text>
          <View className="flex-row bg-gray-100 rounded-xl p-1">
            {(['TrendBased', 'PersonaDriven'] as ContentMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                className="flex-1 py-2.5 rounded-lg items-center"
                style={mode === m ? { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 } : undefined}
                onPress={() => setMode(m)}
              >
                <Text
                  className={`text-sm font-medium ${
                    mode === m ? 'text-primary-600' : 'text-gray-500'
                  }`}
                >
                  {m === 'TrendBased' ? 'Xu hướng' : 'Persona'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* TrendBased: Trend Picker */}
        {mode === 'TrendBased' && (
          <View className="px-5 mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Chọn xu hướng</Text>
            <TouchableOpacity
              className={`border rounded-xl px-4 py-3.5 flex-row items-center justify-between ${
                selectedTrend ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'
              }`}
              onPress={() => setShowTrendPicker(true)}
            >
              <Text
                className={`flex-1 text-sm ${
                  selectedTrend ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}
                numberOfLines={1}
              >
                {selectedTrend ? selectedTrend.title : 'Chọn một xu hướng...'}
              </Text>
              <Text className="text-gray-400 ml-2">▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Platform Selector */}
        <View className="px-5 mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Nền tảng đăng bài</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {PLATFORMS.map((platform) => {
              const selected = selectedPlatforms.includes(platform);
              return (
                <TouchableOpacity
                  key={platform}
                  className={`px-3 py-2 rounded-xl border ${
                    selected
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-white border-gray-200'
                  }`}
                  onPress={() => togglePlatform(platform)}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selected ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    {platform}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Output Count */}
        <View className="px-5 mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Số bài đầu ra</Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {OUTPUT_COUNTS.map((count) => (
              <TouchableOpacity
                key={count}
                className={`w-12 h-12 rounded-xl border items-center justify-center ${
                  outputCount === count
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white border-gray-200'
                }`}
                onPress={() => setOutputCount(count)}
              >
                <Text
                  className={`text-base font-bold ${
                    outputCount === count ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* User Instruction */}
        <View className="px-5 mb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Yêu cầu thêm{' '}
            <Text className="text-gray-400 font-normal">(tùy chọn)</Text>
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 min-h-[80px]"
            placeholder="VD: Tập trung vào đất nền ven đô, nhấn mạnh cơ hội đầu tư 2026..."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            maxLength={1000}
            value={userInstruction}
            onChangeText={setUserInstruction}
          />
          <Text className="text-xs text-gray-400 mt-1 text-right">
            {userInstruction.length}/1000
          </Text>
        </View>

        {/* Generate Button */}
        <View className="px-5">
          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${
              canGenerate && !isPending ? 'bg-primary-500' : 'bg-gray-200'
            }`}
            onPress={handleGenerate}
            disabled={!canGenerate || isPending}
            activeOpacity={0.85}
          >
            {isPending ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text className="text-white font-semibold text-base">AI đang tạo nội dung...</Text>
              </View>
            ) : (
              <Text
                className={`font-semibold text-base ${
                  canGenerate ? 'text-white' : 'text-gray-400'
                }`}
              >
                Tạo nội dung
              </Text>
            )}
          </TouchableOpacity>
          {mode === 'TrendBased' && !selectedTrend && (
            <Text className="text-xs text-gray-400 text-center mt-2">
              Vui lòng chọn một xu hướng trước
            </Text>
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Trend Picker Modal */}
      <Modal
        visible={showTrendPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTrendPicker(false)}
      >
        <View className="flex-1 bg-white">
          <View className="px-5 pt-6 pb-3 border-b border-gray-100">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900">Chọn xu hướng</Text>
              <TouchableOpacity onPress={() => setShowTrendPicker(false)}>
                <Text className="text-primary-500 font-medium">Đóng</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
              placeholder="Tìm kiếm xu hướng..."
              placeholderTextColor="#9CA3AF"
              value={trendSearch}
              onChangeText={setTrendSearch}
            />
          </View>
          <FlatList
            data={filteredTrends}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`p-3 rounded-xl mb-2 border ${
                  selectedTrend?.id === item.id
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-100 bg-white'
                }`}
                onPress={() => {
                  setSelectedTrend(item);
                  setShowTrendPicker(false);
                  setTrendSearch('');
                }}
              >
                <Text className="text-sm font-medium text-gray-900" numberOfLines={2}>
                  {item.title}
                </Text>
                <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                  <Text className="text-xs text-orange-500 font-medium">
                    {item.hotLevel >= 8 ? `HOT ${item.hotLevel}` : item.hotLevel}
                  </Text>
                  {item.tags.slice(0, 2).map((tag) => (
                    <Text key={tag.id} className="text-xs text-gray-400">
                      #{tag.name}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="text-gray-400">Không tìm thấy xu hướng nào</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Quota Exceeded Bottom Sheet */}
      <BottomSheet
        ref={quotaSheetRef}
        index={-1}
        snapPoints={['38%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#FFFFFF', borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB' }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚡</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
            Bạn đã dùng hết lượt hôm nay
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
            Nâng cấp lên gói Pro để tạo thêm nội dung mỗi ngày.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10 }}
            onPress={() => {
              quotaSheetRef.current?.close();
              router.push('/(tabs)/profile');
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Nâng cấp ngay →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 10 }}
            onPress={() => quotaSheetRef.current?.close()}
          >
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Để sau</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}
