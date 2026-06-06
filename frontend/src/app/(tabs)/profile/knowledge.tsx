import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useIngestManual, useScrapeUrl, useUploadFile } from '@/features/knowledge/hooks';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import type { ApiError } from '@/types/api';

type TabType = 'manual' | 'url' | 'file';

// ─── Error message mapping ───────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  KNOWLEDGE_ALREADY_EXISTS: 'Nội dung này đã được thêm trước đó',
  UNSUPPORTED_WEBSITE_SOURCE:
    'Domain này chưa được hỗ trợ. Các domain được phép: vnexpress.net, wikipedia.org, reddit.com, dev.to',
  INVALID_FILE_FORMAT: 'Định dạng file không hợp lệ. Chỉ hỗ trợ .txt, .md, .docx, .pdf',
  CANNOT_EXTRACT_TEXT_FROM_FILE: 'Không thể trích xuất văn bản từ file này',
};

// ─── ManualTab ────────────────────────────────────────────────────────────────

interface ManualTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function ManualTab({ onSuccess, onError }: ManualTabProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { mutate, isPending } = useIngestManual();

  const handleSubmit = useCallback(() => {
    if (!title.trim() || !content.trim()) {
      onError('Vui lòng nhập đầy đủ tiêu đề và nội dung');
      return;
    }

    mutate(
      { title: title.trim(), rawContent: content.trim() },
      {
        onSuccess: (data) => {
          onSuccess(data.message ?? 'Đã thêm kiến thức thành công');
          setTitle('');
          setContent('');
        },
        onError: (err: any) => {
          const code = err?.response?.data?.code;
          onError(ERROR_MESSAGES[code] ?? 'Thêm thất bại, thử lại sau');
        },
      }
    );
  }, [title, content, mutate, onSuccess, onError]);

  return (
    <View className="flex-1">
      <View className="mb-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Tiêu đề
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="VD: Thông tin sản phẩm X"
          className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800"
        />
      </View>

      <View className="mb-4 flex-1">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Nội dung
        </Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Nhập nội dung kiến thức..."
          multiline
          className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 flex-1"
          style={{ textAlignVertical: 'top', minHeight: 200 }}
        />
      </View>

      <Button variant="primary" onPress={handleSubmit} loading={isPending}>
        Thêm kiến thức
      </Button>
    </View>
  );
}

// ─── URLTab ───────────────────────────────────────────────────────────────────

interface URLTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function URLTab({ onSuccess, onError }: URLTabProps) {
  const [url, setUrl] = useState('');
  const { mutate, isPending } = useScrapeUrl();

  const handleCrawl = useCallback(() => {
    if (!url.trim()) {
      onError('Vui lòng nhập URL');
      return;
    }

    mutate(
      { targetUrl: url.trim() },
      {
        onSuccess: (data) => {
          onSuccess(data.message ?? 'Đã crawl thành công');
          setUrl('');
        },
        onError: (err: any) => {
          const code = err?.response?.data?.code;
          onError(ERROR_MESSAGES[code] ?? 'Crawl thất bại, thử lại sau');
        },
      }
    );
  }, [url, mutate, onSuccess, onError]);

  return (
    <View className="flex-1">
      <View className="mb-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          URL
        </Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/article"
          keyboardType="url"
          autoCapitalize="none"
          className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800"
        />
      </View>

      <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
        <Text className="text-xs text-blue-700">
          💡 Các domain được hỗ trợ: vnexpress.net, wikipedia.org, reddit.com, dev.to
        </Text>
      </View>

      <Button variant="primary" onPress={handleCrawl} loading={isPending}>
        {isPending ? 'Đang crawl...' : 'Crawl URL'}
      </Button>
    </View>
  );
}

// ─── FileTab ──────────────────────────────────────────────────────────────────

interface FileTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function FileTab({ onSuccess, onError }: FileTabProps) {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    uri: string;
    mimeType: string;
  } | null>(null);
  const { mutate, isPending } = useUploadFile();

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'text/markdown',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (file.size && file.size > maxSize) {
        onError('File vượt quá 10MB');
        return;
      }

      setSelectedFile({
        name: file.name,
        size: file.size ?? 0,
        uri: file.uri,
        mimeType: file.mimeType ?? 'application/octet-stream',
      });
    } catch (err) {
      onError('Chọn file thất bại');
    }
  }, [onError]);

  const handleUpload = useCallback(() => {
    if (!selectedFile) {
      onError('Vui lòng chọn file');
      return;
    }

    mutate(
      {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType,
      },
      {
        onSuccess: (data) => {
          onSuccess(data.message ?? 'Đã upload thành công');
          setSelectedFile(null);
        },
        onError: (err: any) => {
          const code = err?.response?.data?.code;
          onError(ERROR_MESSAGES[code] ?? 'Upload thất bại, thử lại sau');
        },
      }
    );
  }, [selectedFile, mutate, onSuccess, onError]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View className="flex-1">
      <View className="mb-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Chọn file
        </Text>
        <Button variant="outline" onPress={handlePickFile}>
          📁 Chọn file
        </Button>
      </View>

      {selectedFile && (
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
          <Text className="text-sm font-medium text-gray-800 mb-1">{selectedFile.name}</Text>
          <Text className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</Text>
        </View>
      )}

      <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
        <Text className="text-xs text-blue-700">
          💡 Hỗ trợ: .txt, .md, .docx, .pdf (tối đa 10MB)
        </Text>
      </View>

      <Button
        variant="primary"
        onPress={handleUpload}
        loading={isPending}
        disabled={!selectedFile}
      >
        {isPending ? 'Đang upload...' : 'Upload file'}
      </Button>
    </View>
  );
}

// ─── KnowledgeScreen ──────────────────────────────────────────────────────────

export default function KnowledgeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
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
        <Text className="text-lg font-semibold text-gray-900">Tài liệu tham khảo</Text>
      </View>

      {/* Mô tả tính năng */}
      <View className="bg-blue-50 mx-4 mt-3 mb-1 px-4 py-3 rounded-xl border border-blue-100">
        <Text className="text-sm font-semibold text-blue-800 mb-1">Tính năng này dùng để làm gì?</Text>
        <Text className="text-xs text-blue-700 leading-5">
          Thêm thông tin về sản phẩm, dịch vụ hoặc lĩnh vực của bạn vào đây.
          AI sẽ dùng để tạo nội dung chính xác và phù hợp hơn với bạn.
        </Text>
      </View>

      {/* Segmented Control */}
      <View className="flex-row bg-white px-4 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => setActiveTab('manual')}
          className={`flex-1 py-2 rounded-lg ${
            activeTab === 'manual' ? 'bg-primary-500' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-center text-sm font-medium ${
              activeTab === 'manual' ? 'text-white' : 'text-gray-600'
            }`}
          >
            Văn bản
          </Text>
        </TouchableOpacity>
        <View className="w-2" />
        <TouchableOpacity
          onPress={() => setActiveTab('url')}
          className={`flex-1 py-2 rounded-lg ${
            activeTab === 'url' ? 'bg-primary-500' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-center text-sm font-medium ${
              activeTab === 'url' ? 'text-white' : 'text-gray-600'
            }`}
          >
            URL
          </Text>
        </TouchableOpacity>
        <View className="w-2" />
        <TouchableOpacity
          onPress={() => setActiveTab('file')}
          className={`flex-1 py-2 rounded-lg ${
            activeTab === 'file' ? 'bg-primary-500' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-center text-sm font-medium ${
              activeTab === 'file' ? 'text-white' : 'text-gray-600'
            }`}
          >
            File
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <KeyboardAwareScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        {activeTab === 'manual' && (
          <ManualTab onSuccess={(msg) => showToast(msg)} onError={(msg) => showToast(msg, 'error')} />
        )}
        {activeTab === 'url' && (
          <URLTab onSuccess={(msg) => showToast(msg)} onError={(msg) => showToast(msg, 'error')} />
        )}
        {activeTab === 'file' && (
          <FileTab onSuccess={(msg) => showToast(msg)} onError={(msg) => showToast(msg, 'error')} />
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
