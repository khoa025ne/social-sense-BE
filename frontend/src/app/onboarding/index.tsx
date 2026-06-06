import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store';
import { submitOnboarding, getPersona } from '@/features/persona/api';
import type { PersonaProfile } from '@/types/api';

// ─── Câu hỏi + gợi ý lựa chọn ──────────────────────────────────────────────

const QUESTIONS = [
  {
    id: 1,
    title: 'Công việc của bạn là gì?',
    hint: 'Chọn hoặc tự nhập lĩnh vực của bạn',
    placeholder: 'Hoặc mô tả chi tiết hơn...',
    suggestions: [
      'Bất động sản', 'Marketing', 'Thương mại điện tử',
      'Thời trang & Làm đẹp', 'Ẩm thực & F&B', 'Giáo dục',
      'Tài chính & Đầu tư', 'Công nghệ', 'Y tế & Sức khỏe', 'Khác',
    ],
  },
  {
    id: 2,
    title: 'Bạn muốn tiếp cận ai?',
    hint: 'Chọn nhóm người bạn muốn hướng tới',
    placeholder: 'Hoặc mô tả đối tượng cụ thể hơn...',
    suggestions: [
      'Người trẻ 18–25 tuổi', 'Người đi làm 25–35 tuổi',
      'Phụ huynh có con nhỏ', 'Doanh nhân, chủ doanh nghiệp',
      'Nhà đầu tư', 'Học sinh, sinh viên', 'Phụ nữ nội trợ',
    ],
  },
  {
    id: 3,
    title: 'Bạn đang dùng mạng xã hội nào?',
    hint: 'Chọn các nền tảng bạn muốn đăng bài',
    placeholder: 'Nền tảng khác...',
    suggestions: ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'Zalo', 'LinkedIn', 'X (Twitter)'],
    multiSelect: true,
  },
  {
    id: 4,
    title: 'Bạn muốn viết theo phong cách nào?',
    hint: 'Chọn cách bạn muốn nội dung nghe như thế nào',
    placeholder: 'Hoặc mô tả phong cách riêng...',
    suggestions: [
      'Thân thiện, gần gũi', 'Chuyên nghiệp, uy tín',
      'Vui tươi, hài hước', 'Truyền cảm hứng', 'Đơn giản, dễ hiểu',
      'Sắc sảo, phân tích', 'Kể chuyện cảm xúc',
    ],
  },
];

// ─── SuggestionChips ─────────────────────────────────────────────────────────

interface SuggestionChipsProps {
  suggestions: string[];
  selected: string[];
  multiSelect?: boolean;
  onToggle: (val: string) => void;
}

function SuggestionChips({ suggestions, selected, multiSelect = false, onToggle }: SuggestionChipsProps) {
  return (
    <View className="flex-row flex-wrap gap-2 mb-3">
      {suggestions.map((item) => {
        const isSelected = selected.includes(item);
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onToggle(item)}
            activeOpacity={0.7}
            className={`px-3 py-2 rounded-full border ${
              isSelected
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white border-gray-200'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isSelected ? 'text-white' : 'text-gray-600'
              }`}
            >
              {isSelected && multiSelect ? '✓ ' : ''}{item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── OnboardingScreen ─────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { setHasContext } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  // Mỗi câu: lưu mảng chip đã chọn + text tự nhập
  const [selectedChips, setSelectedChips] = useState<string[][]>(Array(4).fill([]));
  const [customTexts, setCustomTexts] = useState<string[]>(Array(4).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [persona, setPersona] = useState<PersonaProfile | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const question = QUESTIONS[currentStep];
  const isLastStep = currentStep === QUESTIONS.length - 1;

  // Tổng hợp câu trả lời từ chip + text tự nhập
  const buildAnswer = (stepIdx: number): string => {
    const chips = selectedChips[stepIdx];
    const custom = customTexts[stepIdx].trim();
    const parts = [...chips];
    if (custom && !chips.includes(custom)) parts.push(custom);
    return parts.join(', ');
  };

  // Câu nào có ít nhất 1 lựa chọn (chip hoặc text) thì tính là đã điền
  const filledCount = Array(4)
    .fill(0)
    .filter((_, i) => {
      const chips = selectedChips[i];
      const custom = customTexts[i].trim();
      return chips.length > 0 || custom.length > 0;
    }).length;

  const canSubmit = filledCount >= 3;

  const handleToggleChip = (stepIdx: number, val: string) => {
    const current = selectedChips[stepIdx];
    const q = QUESTIONS[stepIdx];
    let updated: string[];

    if (q.multiSelect) {
      // Multi-select: toggle
      updated = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    } else {
      // Single-select: chỉ chọn 1
      updated = current.includes(val) ? [] : [val];
    }

    const newSelected = [...selectedChips];
    newSelected[stepIdx] = updated;
    setSelectedChips(newSelected);
  };

  const handleCustomTextChange = (stepIdx: number, text: string) => {
    const updated = [...customTexts];
    updated[stepIdx] = text;
    setCustomTexts(updated);
  };

  const handleNext = () => {
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Cần thêm thông tin', 'Vui lòng trả lời ít nhất 3 câu hỏi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const answers = Array(4)
        .fill(0)
        .map((_, i) => buildAnswer(i))
        .filter((a) => a.length > 0);

      await submitOnboarding({ language: 'vi', answers });
      const fetchedPersona = await getPersona();
      setPersona(fetchedPersona);
      setShowConfirmation(true);
    } catch {
      Alert.alert('Lỗi', 'Không thể xử lý thông tin. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = () => {
    setHasContext(true);
    router.replace('/(tabs)');
  };

  // ── Màn hình xác nhận persona ─────────────────────────────────────────────
  if (showConfirmation && persona) {
    return (
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 px-6 pt-14 pb-8">
          <View className="items-center mb-8">
            <Text className="text-2xl font-bold text-gray-900 text-center">
              Xong rồi! 🎉
            </Text>
            <Text className="text-gray-500 mt-2 text-center">
              Xem lại thông tin và bắt đầu tạo nội dung
            </Text>
          </View>

          <View className="bg-gray-50 rounded-2xl p-4 gap-3 mb-6">
            {persona.jobTitle ? <PersonaRow label="Nghề nghiệp" value={persona.jobTitle} /> : null}
            {persona.toneOfVoice ? <PersonaRow label="Phong cách viết" value={persona.toneOfVoice} /> : null}
            {persona.platformPreferences?.length > 0 && (
              <PersonaRow label="Nền tảng" value={persona.platformPreferences.join(', ')} />
            )}
            {persona.targetAudience?.length > 0 && (
              <PersonaRow
                label="Tệp người xem"
                value={persona.targetAudience.join(' • ')}
              />
            )}
            {persona.contentFormats?.length > 0 && (
              <PersonaRow label="Định dạng" value={persona.contentFormats.join(', ')} />
            )}
          </View>

          <TouchableOpacity
            className="bg-primary-500 rounded-xl py-4 items-center"
            onPress={handleConfirm}
          >
            <Text className="text-white font-semibold text-base">
              Bắt đầu tạo nội dung →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Màn hình câu hỏi ─────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-white">
      {/* Progress Bar */}
      <View className="px-6 pt-14 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm text-gray-500">
            Câu {currentStep + 1}/{QUESTIONS.length}
          </Text>
          <Text className="text-sm text-gray-500">
            {filledCount}/3 câu tối thiểu
          </Text>
        </View>
        <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-primary-500 rounded-full"
            style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
          />
        </View>
      </View>

      <KeyboardAwareScrollView
        className="flex-1 px-6"
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tiêu đề câu hỏi */}
        <Text className="text-xl font-bold text-gray-900 mb-1">
          {question.title}
        </Text>
        <Text className="text-sm text-gray-500 mb-4">{question.hint}</Text>

        {/* Chip gợi ý */}
        <SuggestionChips
          suggestions={question.suggestions}
          selected={selectedChips[currentStep]}
          multiSelect={question.multiSelect}
          onToggle={(val) => handleToggleChip(currentStep, val)}
        />

        {/* Text tự nhập thêm */}
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
          placeholder={question.placeholder}
          placeholderTextColor="#9CA3AF"
          value={customTexts[currentStep]}
          onChangeText={(text) => handleCustomTextChange(currentStep, text)}
          returnKeyType="done"
        />

        {/* Step dots */}
        <View className="flex-row justify-center gap-2 mt-6">
          {QUESTIONS.map((_, i) => {
            const filled = selectedChips[i].length > 0 || customTexts[i].trim().length > 0;
            return (
              <View
                key={i}
                className={`h-2 rounded-full ${
                  i === currentStep
                    ? 'w-6 bg-primary-500'
                    : filled
                    ? 'w-2 bg-primary-300'
                    : 'w-2 bg-gray-200'
                }`}
              />
            );
          })}
        </View>
      </KeyboardAwareScrollView>

      {/* Navigation Buttons */}
      <View
        className="px-6 pt-4 flex-row gap-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
      >
        {currentStep > 0 && (
          <TouchableOpacity
            className="flex-1 border border-gray-200 rounded-xl py-4 items-center"
            onPress={handleBack}
          >
            <Text className="text-gray-700 font-semibold">← Quay lại</Text>
          </TouchableOpacity>
        )}

        {isLastStep ? (
          <TouchableOpacity
            className={`flex-1 rounded-xl py-4 items-center ${
              canSubmit ? 'bg-primary-500' : 'bg-gray-200'
            }`}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={canSubmit ? '#FFFFFF' : '#9CA3AF'} />
            ) : (
              <Text
                className={`font-semibold text-base ${
                  canSubmit ? 'text-white' : 'text-gray-400'
                }`}
              >
                Hoàn thành ✓
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="flex-1 bg-primary-500 rounded-xl py-4 items-center"
            onPress={handleNext}
          >
            <Text className="text-white font-semibold text-base">Tiếp theo →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function PersonaRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
        {label}
      </Text>
      <Text className="text-sm text-gray-800">{value}</Text>
    </View>
  );
}
