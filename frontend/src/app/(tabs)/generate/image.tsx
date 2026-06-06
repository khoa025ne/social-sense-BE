import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Image as RNImage,
  ActivityIndicator as RNActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useAnalyzeImage, useGenerateImage } from '@/features/content/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { ClarifyingQuestion, ImageAnalyzeResponse, ImageGenerateResponse } from '@/types/api';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

// ─── Platform specs map (client-side reference) ──────────────────────────────

const PLATFORM_SPECS: Record<string, { dimensions: string; aspectRatio: string }> = {
  Facebook:  { dimensions: '1200x630',  aspectRatio: '1.91:1' },
  Instagram: { dimensions: '1080x1080', aspectRatio: '1:1' },
  TikTok:    { dimensions: '1080x1920', aspectRatio: '9:16' },
  Zalo:      { dimensions: '1200x628',  aspectRatio: '1.91:1' },
  LinkedIn:  { dimensions: '1200x627',  aspectRatio: '1.91:1' },
};

const PLATFORMS = Object.keys(PLATFORM_SPECS);

// ─── PlatformSelector ─────────────────────────────────────────────────────────

interface PlatformSelectorProps {
  value: string;
  onChange: (p: string) => void;
  disabled?: boolean;
}

function PlatformSelector({ value, onChange, disabled }: PlatformSelectorProps) {
  return (
    <View>
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Chọn platform
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row" style={{ gap: 8 }}>
          {PLATFORMS.map((p) => {
            const selected = value === p;
            const specs = PLATFORM_SPECS[p];
            return (
              <TouchableOpacity
                key={p}
                onPress={() => !disabled && onChange(p)}
                activeOpacity={disabled ? 1 : 0.7}
                className={`px-3 py-2 rounded-xl border items-center ${
                  selected
                    ? 'bg-primary-500 border-primary-500'
                    : disabled
                    ? 'bg-gray-50 border-gray-100'
                    : 'bg-white border-gray-200'
                }`}
                style={{ minWidth: 90 }}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selected ? 'text-white' : disabled ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  {p}
                </Text>
                <Text
                  className={`text-xs mt-0.5 ${
                    selected ? 'text-primary-100' : 'text-gray-400'
                  }`}
                >
                  {specs.dimensions}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── BannerSpecsBadge ─────────────────────────────────────────────────────────

interface BannerSpecsBadgeProps {
  platform: string;
}

function BannerSpecsBadge({ platform }: BannerSpecsBadgeProps) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      <View className="bg-gray-100 border border-gray-200 px-3 py-1 rounded-full flex-row items-center" style={{ gap: 4 }}>
        <Text className="text-xs font-semibold text-gray-700">{platform}</Text>
      </View>
    </View>
  );
}

// ─── QuestionItem ─────────────────────────────────────────────────────────────

interface QuestionItemProps {
  question: ClarifyingQuestion;
  answer: string;
  onAnswer: (id: string, value: string) => void;
}

function QuestionItem({ question, answer, onAnswer }: QuestionItemProps) {
  return (
    <View className="mb-5">
      <Text className="text-sm font-semibold text-gray-800 mb-3 leading-5">
        {question.question}
      </Text>

      {question.type === 'yesno' && (
        <View className="flex-row" style={{ gap: 8 }}>
          {['Có', 'Không'].map((opt) => {
            const val = opt === 'Có' ? 'yes' : 'no';
            const selected = answer === val;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => onAnswer(question.id, val)}
                className={`flex-1 py-2.5 rounded-xl border items-center ${
                  selected
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {question.type === 'choice' && question.options && (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {question.options.map((opt) => {
            const selected = answer === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => onAnswer(question.id, opt)}
                className={`px-4 py-2 rounded-full border ${
                  selected
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium ${
                    selected ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {question.type === 'text_optional' && (
        <TextInput
          value={answer}
          onChangeText={(v) => onAnswer(question.id, v)}
          placeholder="Nhập câu trả lời (tùy chọn)..."
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
          style={{ textAlignVertical: 'top' }}
          multiline
        />
      )}
    </View>
  );
}

// ─── AnalyzeSkeleton ──────────────────────────────────────────────────────────

function AnalyzeSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <Card variant="outlined">
        <SkeletonLoader height={14} width="50%" borderRadius={7} style={{ marginBottom: 8 }} />
        <SkeletonLoader height={12} width="100%" borderRadius={6} style={{ marginBottom: 6 }} />
        <SkeletonLoader height={12} width="80%" borderRadius={6} style={{ marginBottom: 12 }} />
        <View className="flex-row" style={{ gap: 8 }}>
          <SkeletonLoader height={24} width={80} borderRadius={12} />
          <SkeletonLoader height={24} width={60} borderRadius={12} />
          <SkeletonLoader height={24} width={70} borderRadius={12} />
        </View>
      </Card>
      {[1, 2, 3].map((i) => (
        <Card key={i} variant="outlined">
          <SkeletonLoader height={14} width="70%" borderRadius={7} style={{ marginBottom: 12 }} />
          <View className="flex-row" style={{ gap: 8 }}>
            <SkeletonLoader height={36} width={80} borderRadius={18} />
            <SkeletonLoader height={36} width={80} borderRadius={18} />
          </View>
        </Card>
      ))}
    </View>
  );
}

// ─── GenerateSkeleton ─────────────────────────────────────────────────────────
// Hiển thị progress steps trong khi chờ BE tạo ảnh (5-90 giây)

function GenerateSkeleton() {
  const [step, setStep] = React.useState(0);
  const steps = [
    'Đang phân tích yêu cầu...',
    'AI đang tạo ảnh (có thể mất 30s)...',
    'Đang xử lý và tối ưu ảnh...',
    'Sắp xong rồi...',
  ];

  React.useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 2000),
      setTimeout(() => setStep(2), 12000),
      setTimeout(() => setStep(3), 45000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Card variant="elevated" className="items-center py-8">
      <ActivityIndicator size="large" color="#111827" />
      <Text className="text-sm font-medium text-gray-700 mt-4 text-center">
        {steps[step]}
      </Text>
      {/* Progress dots */}
      <View className="flex-row mt-3" style={{ gap: 6 }}>
        {steps.map((_, i) => (
          <View
            key={i}
            className={`h-1.5 rounded-full ${i <= step ? 'bg-primary-500' : 'bg-gray-200'}`}
            style={{ width: i <= step ? 16 : 8 }}
          />
        ))}
      </View>
      <Text className="text-xs text-gray-400 mt-3 text-center px-4">
        Pollinations AI đang render ảnh.{'\n'}Vui lòng đợi, không tắt màn hình.
      </Text>
    </Card>
  );
}

// ─── PollinationsImage ────────────────────────────────────────────────────────
// BE đã download ảnh và trả base64 data URI — FE chỉ render trực tiếp.
// Không cần fetch thêm, tránh mọi vấn đề Android network.

interface PollinationsImageProps {
  uri: string; // data:image/jpeg;base64,...
}

function PollinationsImage({ uri }: PollinationsImageProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Reset khi uri thay đổi
  React.useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [uri]);

  // Nếu BE chưa restart và vẫn trả URL thay vì base64 → báo lỗi ngay
  const isBase64 = uri.startsWith('data:');
  if (!isBase64) {
    return (
      <View style={{ height: 220, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 20, marginBottom: 8 }}>⚠️</Text>
        <Text style={{ fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 18 }}>
          Cần restart BE server để áp dụng fix mới.{'\n'}Dùng "Sao chép prompt" để tạo ảnh với Midjourney.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', borderRadius: 12, backgroundColor: '#F3F4F6' }}>
      {!loaded && !error && (
        <View style={{ height: 220, alignItems: 'center', justifyContent: 'center' }}>
          <RNActivityIndicator color="#111827" size="large" />
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 12 }}>Đang hiển thị ảnh...</Text>
        </View>
      )}
      {error && (
        <View style={{ height: 220, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <MaterialIcons name="broken-image" size={28} color="#9CA3AF" style={{ marginBottom: 8 }} />
          <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 18 }}>
            Không hiển thị được ảnh.{'\n'}Dùng "Sao chép prompt" để dùng với Midjourney.
          </Text>
        </View>
      )}
      <RNImage
        source={{ uri }}
        style={{ width: '100%', height: loaded ? 220 : 0, borderRadius: 12 }}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(false); }}
      />
    </View>
  );
}


// ─── ResultView ───────────────────────────────────────────────────────────────

interface ResultViewProps {
  result: ImageGenerateResponse;
  onCopyPrompt: () => void;
  onShare: () => void;
}

function ResultView({ result, onCopyPrompt, onShare }: ResultViewProps) {
  return (
    <View style={{ gap: 16 }}>
      {/* Banner specs */}
      <Card variant="outlined">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Thông số banner
        </Text>
        <BannerSpecsBadge
          platform={result.bannerSpecs.platform}
        />
        {result.bannerSpecs.recommendedStyle ? (
          <Text className="text-xs text-gray-500 mt-2 leading-4">
            {result.bannerSpecs.recommendedStyle}
          </Text>
        ) : null}
      </Card>

      {/* Generated image */}
      {result.isGenerated && result.imageUrl ? (
        <Card variant="elevated">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            ✅ Ảnh đã tạo
          </Text>
          <PollinationsImage key={result.imageUrl} uri={result.imageUrl} />
          <View className="flex-row mt-3" style={{ gap: 8 }}>
            <TouchableOpacity
              className="flex-1 border border-gray-200 rounded-xl py-2.5 items-center flex-row justify-center"
              style={{ gap: 4 }}
              onPress={onShare}
            >
              <MaterialIcons name="share" size={14} color="#374151" />
              <Text className="text-sm font-medium text-gray-700">Chia sẻ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 border border-primary-200 rounded-xl py-2.5 items-center flex-row justify-center"
              style={{ gap: 4 }}
              onPress={onCopyPrompt}
            >
              <MaterialIcons name="content-copy" size={14} color="#2563EB" />
              <Text className="text-sm font-medium text-primary-600">Sao chép prompt</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : (
        /* Prompt-only result */
        <Card variant="outlined">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Final Prompt
            </Text>
            <TouchableOpacity onPress={onCopyPrompt}>
              <Text className="text-xs text-primary-500 font-medium">Sao chép</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-gray-50 rounded-xl p-3 mb-3">
            <Text className="text-sm text-gray-800 leading-5 font-mono">
              {result.finalPrompt}
            </Text>
          </View>
          {result.promptUsageTip ? (
            <View className="bg-amber-50 rounded-xl px-3 py-2.5">
              <Text className="text-xs text-amber-700 leading-4">
                {result.promptUsageTip}
              </Text>
            </View>
          ) : null}
          <View className="mt-3">
            <Button variant="primary" onPress={onCopyPrompt}>
              Sao chép prompt
            </Button>
          </View>
        </Card>
      )}
    </View>
  );
}

// ─── ImageGeneratorScreen ─────────────────────────────────────────────────────

export default function ImageGeneratorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    contentText?: string;
    platform?: string;
    contentHistoryId?: string;
    bannerImagePrompt?: string;
  }>();

  const platform = params.platform ?? 'Facebook';
  // Decode \\n → \n (Expo Router không truyền được newline thật qua URL params)
  const contentText = params.contentText
    ? params.contentText.replace(/\\n/g, '\n')
    : undefined;
  const contentHistoryId = params.contentHistoryId
    ? parseInt(params.contentHistoryId, 10)
    : undefined;
  // bannerImagePrompt từ content generation — dùng làm draftPrompt hint khi analyze
  const bannerImagePrompt = params.bannerImagePrompt || undefined;

  // Platform có thể được user thay đổi trước khi analyze
  const [selectedPlatform, setSelectedPlatform] = useState(platform);

  // Dùng local state để lưu kết quả — tránh stale data từ mutation cache
  const [analyzeResult, setAnalyzeResult] = useState<ImageAnalyzeResponse | null>(null);
  const [generateResult, setGenerateResult] = useState<ImageGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'success' });

  // Quota exceeded bottom sheet
  const quotaSheetRef = useRef<BottomSheet>(null);

  const { mutate: analyzeMutate, isPending: isAnalyzing } = useAnalyzeImage();
  const { mutate: generateMutate, isPending: isGenerating, reset: resetGenerateMutation } = useGenerateImage();

  // ── Auto-trigger analyze on mount + khi params thay đổi ───────────────────
  useEffect(() => {
    // Guard: phải có ít nhất 1 trong 2
    if (!contentText && !contentHistoryId) {
      setToast({
        visible: true,
        message: 'Thiếu nội dung để phân tích',
        type: 'error',
      });
      return;
    }

    // Reset toàn bộ state khi content thay đổi (navigate từ content khác)
    setAnalyzeResult(null);
    setGenerateResult(null);
    setAnswers({});
    resetGenerateMutation();
    setSelectedPlatform(platform);
    setAnalyzeResult(null);
    setGenerateResult(null);
    setAnswers({});

    analyzeMutate(
      { contentText, contentHistoryId, platform: selectedPlatform },
      {
        onSuccess: (data) => setAnalyzeResult(data),
        onError: (err: any) => {
          const status = err?.response?.status;
          const msg = err?.response?.data?.message ?? err?.message ?? 'unknown';
          console.error('[ImageAnalyze] error', status, msg);
          setToast({
            visible: true,
            message: `Phân tích thất bại (${status ?? 'network'})`,
            type: 'error',
          });
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentText, contentHistoryId]);

  const handleAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  // Đổi platform → reset toàn bộ và re-analyze
  const handlePlatformChange = useCallback((newPlatform: string) => {
    if (newPlatform === selectedPlatform) return;
    setSelectedPlatform(newPlatform);
    setAnalyzeResult(null);
    setGenerateResult(null);
    setAnswers({});
    resetGenerateMutation();

    analyzeMutate(
      { contentText, contentHistoryId, platform: newPlatform },
      {
        onSuccess: (data) => setAnalyzeResult(data),
        onError: () =>
          setToast({ visible: true, message: 'Phân tích thất bại, thử lại sau', type: 'error' }),
      }
    );
  }, [selectedPlatform, contentText, contentHistoryId, analyzeMutate, resetGenerateMutation]);

  const handleGenerate = useCallback(() => {
    if (!analyzeResult) return;
    generateMutate(
      {
        contentText,
        contentHistoryId,
        platform: selectedPlatform,
        // Ưu tiên draftPrompt từ AI analyze; fallback về bannerImagePrompt từ content gen
        draftPrompt: analyzeResult.draftPrompt || bannerImagePrompt || '',
        detectedIndustry: analyzeResult.detectedIndustry,
        answers,
      },
      {
        onSuccess: (data) => setGenerateResult(data),
        onError: (err) => {
          const axiosError = err as AxiosError<ApiError>;
          if (axiosError.response?.status === 429) {
            // Hết quota — hiển thị bottom sheet nâng cấp
            quotaSheetRef.current?.expand();
          } else {
            setToast({ visible: true, message: 'Tạo ảnh thất bại, thử lại sau', type: 'error' });
          }
        },
      }
    );
  }, [analyzeResult, answers, contentText, contentHistoryId, platform, generateMutate]);

  const handleCopyPrompt = useCallback(async () => {
    const prompt = generateResult?.finalPrompt ?? analyzeResult?.draftPrompt ?? '';
    if (!prompt) return;
    await Clipboard.setStringAsync(prompt);
    setToast({ visible: true, message: 'Đã sao chép prompt', type: 'success' });
  }, [generateResult, analyzeResult]);

  const handleShare = useCallback(async () => {
    if (!generateResult?.imageUrl) return;
    const url = generateResult.imageUrl;

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;

      if (url.startsWith('data:')) {
        // base64 — ghi ra file tạm rồi share
        const base64Data = url.split(',')[1];
        const ext = url.includes('image/png') ? 'png' : 'jpg';
        const fileUri = `${FileSystem.cacheDirectory}banner_${Date.now()}.${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri, { mimeType: `image/${ext}` });
      } else {
        // URL thông thường — download rồi share
        const fileUri = `${FileSystem.cacheDirectory}banner_${Date.now()}.jpg`;
        await FileSystem.downloadAsync(url, fileUri);
        await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg' });
      }
    } catch {
      // Fallback: share URL text nếu file sharing thất bại
      await Share.share({ message: url });
    }
  }, [generateResult]);

  const handleReset = useCallback(() => {
    resetGenerateMutation(); // clear mutation state
    setGenerateResult(null);
    setAnswers({});
  }, [resetGenerateMutation]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((p) => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => {
            if (params.contentHistoryId) {
              router.navigate(`/(tabs)/history/${params.contentHistoryId}` as any);
            } else {
              router.navigate('/(tabs)/generate/result' as any);
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">Tạo ảnh banner</Text>
          <Text className="text-xs text-gray-400">AI tạo ảnh theo nội dung của bạn</Text>
        </View>
        {/* Platform badge */}
        <View className="bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
          <Text className="text-xs font-semibold text-gray-700">{selectedPlatform}</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Platform selector — luôn hiển thị, disabled khi đang analyze/generate ── */}
        <Card variant="outlined" className="mb-0">
          <PlatformSelector
            value={selectedPlatform}
            onChange={handlePlatformChange}
            disabled={isAnalyzing || isGenerating}
          />
        </Card>

        {/* ── Step 1: Analyzing ── */}
        {isAnalyzing && <AnalyzeSkeleton />}

        {/* ── Step 1: Analyze failed / chưa chạy — nút retry ── */}
        {!isAnalyzing && !analyzeResult && !generateResult && (
          <Card variant="outlined">
            <View className="items-center py-6" style={{ gap: 12 }}>
              <MaterialIcons name="image" size={40} color="#9CA3AF" />
              <Text className="text-sm font-semibold text-gray-700 text-center">
                Phân tích nội dung thất bại
              </Text>
              <Text className="text-xs text-gray-400 text-center leading-4">
                Không thể kết nối AI. Kiểm tra kết nối mạng và thử lại.
              </Text>
              <TouchableOpacity
                className="bg-primary-500 px-6 py-2.5 rounded-xl"
                onPress={() => {
                  analyzeMutate(
                    { contentText, contentHistoryId, platform: selectedPlatform },
                    {
                      onSuccess: (data) => setAnalyzeResult(data),
                      onError: () =>
                        setToast({ visible: true, message: 'Phân tích thất bại, thử lại sau', type: 'error' }),
                    }
                  );
                }}
              >
                <Text className="text-white text-sm font-semibold">Thử lại</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ── Step 1: Analyze result + questions ── */}
        {!isAnalyzing && analyzeResult && !generateResult && (
          <View style={{ gap: 16 }}>
            {/* Image summary + banner specs */}
            <Card variant="outlined">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                AI phân tích
              </Text>
              <Text className="text-sm text-gray-800 leading-5 mb-3">
                {analyzeResult.imageSummary}
              </Text>
              <BannerSpecsBadge
                platform={analyzeResult.bannerSpecs.platform}
              />
              {analyzeResult.bannerSpecs.recommendedStyle ? (
                <Text className="text-xs text-gray-500 mt-2 leading-4">
                  {analyzeResult.bannerSpecs.recommendedStyle}
                </Text>
              ) : null}
              {/* Quota note */}
              <View className="mt-3 bg-amber-50 rounded-xl px-3 py-2 flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-xs">⚡</Text>
                <Text className="text-xs text-amber-700">Bước tạo ảnh sẽ tốn 1 quota</Text>
              </View>
            </Card>

            {/* Clarifying questions */}
            {analyzeResult.clarifyingQuestions.length > 0 && (
              <Card variant="outlined">
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Làm rõ thêm (tùy chọn)
                </Text>
                {analyzeResult.clarifyingQuestions.map((q) => (
                  <QuestionItem
                    key={q.id}
                    question={q}
                    answer={answers[q.id] ?? ''}
                    onAnswer={handleAnswer}
                  />
                ))}
              </Card>
            )}

            {/* ── Step 2: Generating skeleton — hiển thị ngay trong flow ── */}
            {isGenerating ? (
              <GenerateSkeleton />
            ) : (
              <>
                {/* Generate button */}
                <Button
                  variant="primary"
                  size="lg"
                  onPress={handleGenerate}
                  disabled={isGenerating}
                >
                  Tạo ảnh banner (1 quota)
                </Button>

                {/* Copy draft prompt shortcut */}
                <TouchableOpacity
                  className="items-center py-2"
                  onPress={handleCopyPrompt}
                >
                  <Text className="text-xs text-gray-400">
                    Hoặc{' '}
                    <Text className="text-primary-500 font-medium">sao chép draft prompt</Text>
                    {' '}để dùng với Midjourney
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Step 2: Result ── */}
        {generateResult && !isGenerating && (
          <View style={{ gap: 16 }}>
            <ResultView
              result={generateResult}
              onCopyPrompt={handleCopyPrompt}
              onShare={handleShare}
            />
            <Button variant="outline" onPress={handleReset}>
              Tạo lại với câu trả lời khác
            </Button>
          </View>
        )}
      </ScrollView>

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
            Tạo ảnh banner tốn 1 quota. Nâng cấp lên Pro (50 lượt/ngày) để tiếp tục.
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
    </SafeAreaView>
  );
}
