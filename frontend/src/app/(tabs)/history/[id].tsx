import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHistory, editHistory } from '@/features/content/api';
import { contentKeys, useEditHistory } from '@/features/content/hooks';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Config } from '@/constants/config';
import type { ContentHistoryItem, GeneratedContentItem } from '@/types/api';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// ─── Platform icon map ────────────────────────────────────────────────────────
// (removed — không dùng emoji icon nữa)

// ─── ContentBlock ─────────────────────────────────────────────────────────────

interface ContentBlockProps {
  label: string;
  value: string;
  onCopy?: () => void;
}

function ContentBlock({ label, value, onCopy }: ContentBlockProps) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</Text>
        {onCopy && (
          <TouchableOpacity onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-xs text-primary-500 font-medium">Sao chép</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text className="text-sm text-gray-800 leading-5">{value}</Text>
    </View>
  );
}

// ─── EditForm ─────────────────────────────────────────────────────────────────

interface EditFormProps {
  initialHook: string;
  initialBody: string;
  initialCta: string;
  onSave: (hook: string, body: string, cta: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function EditForm({ initialHook, initialBody, initialCta, onSave, onCancel, isSaving }: EditFormProps) {
  const [hook, setHook] = useState(initialHook);
  const [body, setBody] = useState(initialBody);
  const [cta, setCta] = useState(initialCta);

  return (
    <View>
      <Text className="text-base font-semibold text-gray-900 mb-4">Chỉnh sửa nội dung</Text>

      {/* Hook */}
      <View className="mb-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hook</Text>
        <TextInput
          value={hook}
          onChangeText={setHook}
          multiline
          numberOfLines={3}
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800"
          style={{ textAlignVertical: 'top', minHeight: 72 }}
          placeholder="Nhập hook..."
        />
      </View>

      {/* Body */}
      <View className="mb-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nội dung</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={6}
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800"
          style={{ textAlignVertical: 'top', minHeight: 120 }}
          placeholder="Nhập nội dung..."
        />
      </View>

      {/* CTA */}
      <View className="mb-6">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">CTA</Text>
        <TextInput
          value={cta}
          onChangeText={setCta}
          multiline
          numberOfLines={2}
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800"
          style={{ textAlignVertical: 'top', minHeight: 56 }}
          placeholder="Nhập CTA..."
        />
      </View>

      {/* Actions */}
      <View className="flex-row gap-3">
        <Button variant="outline" onPress={onCancel} className="flex-1">
          Hủy
        </Button>
        <Button
          variant="primary"
          onPress={() => onSave(hook, body, cta)}
          loading={isSaving}
          className="flex-1"
        >
          Lưu
        </Button>
      </View>
    </View>
  );
}

// ─── ContentCard ──────────────────────────────────────────────────────────────

interface ContentCardProps {
  content: GeneratedContentItem;
  historyId: number;
  onCopyAll: () => void;
  onShare: () => void;
  onEdit: () => void;
  onImage: () => void;
}

function ContentCard({ content, historyId, onCopyAll, onShare, onEdit, onImage }: ContentCardProps) {
  return (
    <Card variant="outlined" className="mb-4">
      {/* Platform header */}
      <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <Text className="text-base font-semibold text-gray-900">{content.platform}</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={onCopyAll}
            className="bg-gray-100 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
          >
            <MaterialIcons name="content-copy" size={13} color="#374151" />
            <Text className="text-xs text-gray-700 font-medium">Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onShare}
            className="bg-gray-100 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
          >
            <MaterialIcons name="share" size={13} color="#374151" />
            <Text className="text-xs text-gray-700 font-medium">Chia sẻ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onEdit}
            className="bg-primary-50 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
          >
            <MaterialIcons name="edit" size={13} color="#2563EB" />
            <Text className="text-xs text-primary-600 font-medium">Sửa</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ContentBlock label="Hook" value={content.hook} />
      <ContentBlock label="Nội dung" value={content.body} />
      <ContentBlock label="CTA" value={content.cta} />

      {/* Hashtags */}
      {content.hashtags?.length > 0 && (
        <View className="mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Hashtags</Text>
          <View className="flex-row flex-wrap gap-1">
            {content.hashtags.map((tag, i) => (
              <View key={i} className="bg-primary-50 px-2 py-0.5 rounded-full">
                <Text className="text-xs text-primary-600">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Best time to post */}
      {content.bestTimeToPost ? (
        <View className="flex-row items-center gap-2 bg-amber-50 px-3 py-2 rounded-xl">
          <MaterialIcons name="schedule" size={14} color="#92400E" />
          <Text className="text-xs text-amber-700 font-medium">{content.bestTimeToPost}</Text>
        </View>
      ) : null}

      {/* Image banner shortcut */}
      <TouchableOpacity
        className="mt-3 border border-gray-200 bg-gray-50 rounded-xl py-2.5 items-center flex-row justify-center"
        style={{ gap: 6 }}
        onPress={onImage}
        activeOpacity={0.7}
      >
        <MaterialIcons name="image" size={16} color="#374151" />
        <Text className="text-sm font-medium text-gray-700">Tạo ảnh banner</Text>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [editingContentIndex, setEditingContentIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // Lấy item từ cache TanStack Query
  const cachedData = qc.getQueriesData<{ pages: Array<{ items: ContentHistoryItem[] }> }>({
    queryKey: contentKeys.history,
  });

  const historyItem: ContentHistoryItem | undefined = cachedData
    .flatMap(([, data]) => data?.pages ?? [])
    .flatMap((page) => page.items)
    .find((item) => String(item.id) === id);

  const { mutate: editMutate, isPending: isSaving } = useEditHistory();

  // Nếu không tìm thấy trong cache, fetch trực tiếp
  const [localItem, setLocalItem] = useState<ContentHistoryItem | undefined>(historyItem);

  React.useEffect(() => {
    if (historyItem) {
      setLocalItem(historyItem);
    }
  }, [historyItem]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const buildFullText = useCallback((content: GeneratedContentItem) => {
    const parts = [content.hook, content.body, content.cta];
    if (content.hashtags?.length) {
      parts.push(content.hashtags.join(' '));
    }
    return parts.filter(Boolean).join('\n\n');
  }, []);

  const handleCopyAll = useCallback(
    async (content: GeneratedContentItem) => {
      await Clipboard.setStringAsync(buildFullText(content));
      showToast('Đã sao chép');
    },
    [buildFullText, showToast]
  );

  const handleShare = useCallback(
    async (content: GeneratedContentItem) => {
      try {
        await Share.share({ message: buildFullText(content) });
      } catch {
        // user cancelled
      }
    },
    [buildFullText]
  );

  const handleSaveEdit = useCallback(
    (contentIndex: number, hook: string, body: string, cta: string) => {
      if (!localItem) return;

      editMutate(
        { id: localItem.id, data: { hook, body, cta } },
        {
          onSuccess: () => {
            showToast('Đã lưu chỉnh sửa');
            setEditingContentIndex(null);
            // Cập nhật local state để phản ánh ngay
            setLocalItem((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                isEdited: true,
                userEditedContent: { hook, body, cta },
              };
            });
          },
          onError: (error: any) => {
            const code = error?.response?.data?.code;
            if (code === 'HISTORY_NOT_FOUND') {
              showToast('Không tìm thấy nội dung', 'error');
              // Xóa khỏi cache
              qc.setQueriesData<{ pages: Array<{ items: ContentHistoryItem[] }> }>(
                { queryKey: contentKeys.history },
                (old) => {
                  if (!old) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page) => ({
                      ...page,
                      items: page.items.filter((i) => i.id !== localItem.id),
                    })),
                  };
                }
              );
              router.back();
            } else {
              showToast('Lưu thất bại, thử lại sau', 'error');
            }
          },
        }
      );
    },
    [localItem, editMutate, showToast, qc, router]
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!localItem) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#111827" />
      </SafeAreaView>
    );
  }

  const formattedDate = localItem.createdAt
    ? format(new Date(localItem.createdAt), "EEEE, dd/MM/yyyy 'lúc' HH:mm", { locale: vi })
    : '';

  // Nội dung hiển thị: nếu đã edit thì merge userEditedContent vào đúng platform đang được edit
  // BE lưu userEditedContent chung cho item, áp dụng vào tất cả platform để nhất quán
  const displayContents: GeneratedContentItem[] = localItem.generatedContent.map((c) => {
    if (localItem.userEditedContent) {
      return { ...c, ...localItem.userEditedContent };
    }
    return c;
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/history' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            Chi tiết nội dung
          </Text>
          <Text className="text-xs text-gray-400">{formattedDate}</Text>
        </View>
        {localItem.isEdited && (
          <View className="bg-amber-100 px-2 py-0.5 rounded-full">
            <Text className="text-xs text-amber-600 font-medium">Đã chỉnh sửa</Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {displayContents.map((content, index) => (
          <View key={`${content.platform}-${index}`}>
            {editingContentIndex === index ? (
              <Card variant="outlined" className="mb-4">
                <EditForm
                  initialHook={content.hook}
                  initialBody={content.body}
                  initialCta={content.cta}
                  onSave={(hook, body, cta) => handleSaveEdit(index, hook, body, cta)}
                  onCancel={() => setEditingContentIndex(null)}
                  isSaving={isSaving}
                />
              </Card>
            ) : (
              <ContentCard
                content={content}
                historyId={localItem.id}
                onCopyAll={() => handleCopyAll(content)}
                onShare={() => handleShare(content)}
                onEdit={() => setEditingContentIndex(index)}
                onImage={() =>
                  router.push({
                    pathname: '/(tabs)/generate/image',
                    params: {
                      contentHistoryId: String(localItem.id),
                      platform: content.platform,
                      // Truyền bannerImagePrompt để skip analyze step nếu có
                      bannerImagePrompt: content.bannerImagePrompt ?? '',
                    },
                  })
                }
              />
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
