import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePersona, useUpdatePersona } from '@/features/persona/hooks';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import type { UpdatePersonaRequest } from '@/types/api';

// ─── SuggestionChips ──────────────────────────────────────────────────────────

interface SuggestionChipsProps {
  suggestions: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

function SuggestionChips({ suggestions, selectedValues, onToggle }: SuggestionChipsProps) {
  return (
    <View className="flex-row flex-wrap gap-2 mb-3">
      {suggestions.map((item) => {
        const isSelected = selectedValues.includes(item);
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onToggle(item)}
            activeOpacity={0.7}
            className={`px-3 py-1.5 rounded-full border ${
              isSelected
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white border-gray-200'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                isSelected ? 'text-white' : 'text-gray-600'
              }`}
            >
              {isSelected ? '✓ ' : ''}{item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── TagInput Component ───────────────────────────────────────────────────────

interface TagInputProps {
  label: string;
  description?: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

function TagInput({ label, description, tags, onTagsChange, placeholder, suggestions }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setInputValue('');
    }
  };

  const handleToggleSuggestion = (value: string) => {
    if (tags.includes(value)) {
      onTagsChange(tags.filter((t) => t !== value));
    } else {
      onTagsChange([...tags, value]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  return (
    <View className="mb-5">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </Text>
      {description && (
        <Text className="text-xs text-gray-400 mb-2">{description}</Text>
      )}

      {/* Gợi ý nhanh */}
      {suggestions && suggestions.length > 0 && (
        <SuggestionChips
          suggestions={suggestions}
          selectedValues={tags}
          onToggle={handleToggleSuggestion}
        />
      )}

      {/* Tags đã chọn (bao gồm cả tự nhập) */}
      {tags.filter((t) => !suggestions?.includes(t)).length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-2">
          {tags
            .filter((t) => !suggestions?.includes(t))
            .map((tag, idx) => (
              <View key={idx} className="flex-row items-center bg-primary-50 px-3 py-1.5 rounded-full">
                <Text className="text-sm text-primary-700 mr-1">{tag}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveTag(tag)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text className="text-primary-500 font-bold">×</Text>
                </TouchableOpacity>
              </View>
            ))}
        </View>
      )}

      {/* Input tự nhập thêm */}
      <View className="flex-row gap-2">
        <TextInput
          value={inputValue}
          onChangeText={setInputValue}
          placeholder={placeholder ?? 'Hoặc tự nhập...'}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800"
          onSubmitEditing={handleAddTag}
          returnKeyType="done"
        />
        <Button variant="primary" size="sm" onPress={handleAddTag}>
          Thêm
        </Button>
      </View>
    </View>
  );
}

// ─── PersonaScreen ────────────────────────────────────────────────────────────

const TONE_SUGGESTIONS = [
  'Thân thiện', 'Chuyên nghiệp', 'Hài hước', 'Truyền cảm hứng',
  'Gần gũi', 'Nghiêm túc', 'Sáng tạo', 'Đơn giản, dễ hiểu',
];

const PLATFORM_SUGGESTIONS = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'Zalo', 'LinkedIn', 'X (Twitter)'];

const AUDIENCE_SUGGESTIONS = [
  'Doanh nhân', 'Sinh viên', 'Gen Z', 'Millennials', 'Phụ huynh',
  'Nhà đầu tư', 'Người mới bắt đầu', 'Chuyên gia ngành',
];

const FORMAT_SUGGESTIONS = ['Bài viết ngắn', 'Video ngắn', 'Infographic', 'Story', 'Reels', 'Thread'];

export default function PersonaScreen() {
  const router = useRouter();
  const { data: persona, isLoading } = usePersona();
  const { mutate: updateMutate, isPending: isSaving } = useUpdatePersona();

  const [jobTitle, setJobTitle] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('');
  const [language, setLanguage] = useState('vi');
  const [platformPreferences, setPlatformPreferences] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [contentFormats, setContentFormats] = useState<string[]>([]);
  const [negativeConstraints, setNegativeConstraints] = useState<string[]>([]);

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    if (persona) {
      setJobTitle(persona.jobTitle ?? '');
      setToneOfVoice(persona.toneOfVoice ?? '');
      setLanguage(persona.language ?? 'vi');
      setPlatformPreferences(persona.platformPreferences ?? []);
      setTargetAudience(persona.targetAudience ?? []);
      setContentFormats(persona.contentFormats ?? []);
      setNegativeConstraints(persona.negativeConstraints ?? []);
    }
  }, [persona]);

  const handleSave = useCallback(() => {
    const updates: UpdatePersonaRequest = {};

    if (jobTitle !== persona?.jobTitle) updates.jobTitle = jobTitle;
    if (toneOfVoice !== persona?.toneOfVoice) updates.toneOfVoice = toneOfVoice;
    if (language !== persona?.language) updates.language = language;

    if (JSON.stringify(platformPreferences) !== JSON.stringify(persona?.platformPreferences)) {
      updates.platformPreferences = platformPreferences;
    }
    if (JSON.stringify(targetAudience) !== JSON.stringify(persona?.targetAudience)) {
      updates.targetAudience = targetAudience;
    }
    if (JSON.stringify(contentFormats) !== JSON.stringify(persona?.contentFormats)) {
      updates.contentFormats = contentFormats;
    }
    if (JSON.stringify(negativeConstraints) !== JSON.stringify(persona?.negativeConstraints)) {
      updates.negativeConstraints = negativeConstraints;
    }

    if (Object.keys(updates).length === 0) {
      showToast('Không có thay đổi nào', 'error');
      return;
    }

    updateMutate(updates, {
      onSuccess: () => {
        showToast('Đã lưu thành công');
      },
      onError: () => {
        showToast('Lưu thất bại, thử lại sau', 'error');
      },
    });
  }, [
    jobTitle, toneOfVoice, language,
    platformPreferences, targetAudience, contentFormats, negativeConstraints,
    persona, updateMutate, showToast,
  ]);

  if (isLoading) {
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

      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/profile' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Phong cách & Đối tượng</Text>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Job Title */}
        <View className="mb-5">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Ngành nghề / Vai trò
          </Text>
          <TextInput
            value={jobTitle}
            onChangeText={setJobTitle}
            placeholder="VD: Chuyên viên Marketing BĐS"
            className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800"
          />
        </View>

        {/* Phong cách viết — có gợi ý chip */}
        <View className="mb-5">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Phong cách viết
          </Text>
          <Text className="text-xs text-gray-400 mb-2">
            Bạn muốn nội dung nghe như thế nào? Chọn hoặc tự nhập
          </Text>
          <SuggestionChips
            suggestions={TONE_SUGGESTIONS}
            selectedValues={toneOfVoice ? toneOfVoice.split(', ').map(s => s.trim()).filter(Boolean) : []}
            onToggle={(val) => {
              const current = toneOfVoice ? toneOfVoice.split(', ').map(s => s.trim()).filter(Boolean) : [];
              const updated = current.includes(val)
                ? current.filter((v) => v !== val)
                : [...current, val];
              setToneOfVoice(updated.join(', '));
            }}
          />
          <TextInput
            value={toneOfVoice}
            onChangeText={setToneOfVoice}
            placeholder="VD: Thân thiện, chuyên nghiệp"
            className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800"
          />
        </View>

        {/* Ngôn ngữ */}
        <View className="mb-5">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Ngôn ngữ nội dung
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setLanguage('vi')}
              className={`flex-1 py-3 rounded-xl border ${
                language === 'vi' ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-center font-medium ${language === 'vi' ? 'text-primary-600' : 'text-gray-600'}`}>
                🇻🇳 Tiếng Việt
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLanguage('en')}
              className={`flex-1 py-3 rounded-xl border ${
                language === 'en' ? 'bg-primary-50 border-primary-500' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-center font-medium ${language === 'en' ? 'text-primary-600' : 'text-gray-600'}`}>
                🇺🇸 English
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Nền tảng */}
        <TagInput
          label="Nền tảng bạn đang dùng"
          description="Bạn đang đăng bài ở đâu?"
          tags={platformPreferences}
          onTagsChange={setPlatformPreferences}
          placeholder="Nền tảng khác..."
          suggestions={PLATFORM_SUGGESTIONS}
        />

        {/* Tệp người xem */}
        <TagInput
          label="Tệp người xem bạn muốn hướng tới"
          description="Ai là người bạn muốn tiếp cận?"
          tags={targetAudience}
          onTagsChange={setTargetAudience}
          placeholder="Nhóm đối tượng khác..."
          suggestions={AUDIENCE_SUGGESTIONS}
        />

        {/* Định dạng nội dung */}
        <TagInput
          label="Định dạng nội dung"
          tags={contentFormats}
          onTagsChange={setContentFormats}
          placeholder="Định dạng khác..."
          suggestions={FORMAT_SUGGESTIONS}
        />

        {/* Ràng buộc */}
        <TagInput
          label="Những gì bạn muốn tránh"
          description="Chủ đề hoặc cách viết bạn không muốn xuất hiện"
          tags={negativeConstraints}
          onTagsChange={setNegativeConstraints}
          placeholder="VD: Không dùng từ ngữ tiêu cực"
        />

        {/* Save */}
        <View className="mt-4">
          <Button variant="primary" onPress={handleSave} loading={isSaving}>
            Lưu thay đổi
          </Button>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
