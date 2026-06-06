import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useContentStore } from '@/features/content/store';
import { Toast } from '@/components/ui/Toast';
import type { GeneratedContentItem } from '@/types/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ContentCardProps {
  item: GeneratedContentItem;
  index: number;
  total: number;
  onCopy: () => void;
  onShare: () => void;
  onImage: () => void;
}

function ContentCard({ item, index, total, onCopy, onShare, onImage }: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ width: SCREEN_WIDTH - 40, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }} className="bg-white border border-gray-100 rounded-2xl p-4">
      {/* Platform + indicator */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="bg-primary-100 px-3 py-1 rounded-full">
          <Text className="text-primary-600 text-xs font-semibold">{item.platform}</Text>
        </View>
        <Text className="text-xs text-gray-400">{index + 1}/{total}</Text>
      </View>

      <View className="h-px bg-gray-100 mb-3" />

      {/* Hook */}
      <View className="mb-3">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hook</Text>
        <Text className="text-sm font-semibold text-gray-900 leading-5">{item.hook}</Text>
      </View>

      {/* Body — expandable */}
      <View className="mb-3">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Nội dung</Text>
        <Text
          className="text-sm text-gray-700 leading-5"
          numberOfLines={expanded ? undefined : 3}
        >
          {item.body}
        </Text>
        {item.body.length > 120 && (
          <TouchableOpacity onPress={() => setExpanded(!expanded)}>
            <Text className="text-primary-500 text-xs mt-1">
              {expanded ? 'Thu gọn ▲' : 'Xem thêm ▼'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* CTA */}
      <View className="mb-3">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">CTA</Text>
        <Text className="text-sm text-gray-700 italic">{item.cta}</Text>
      </View>

      {/* Hashtags */}
      <View className="flex-row flex-wrap mb-3" style={{ gap: 4 }}>
        {item.hashtags.map((tag, i) => (
          <View key={i} className="bg-gray-100 px-2 py-0.5 rounded-full">
            <Text className="text-xs text-gray-600">#{tag}</Text>
          </View>
        ))}
      </View>

      {/* Best time to post */}
      <View className="flex-row items-center gap-2 bg-amber-50 rounded-xl px-3 py-2 mb-4">
        <MaterialIcons name="schedule" size={13} color="#92400E" />
        <Text className="text-xs text-amber-700 flex-1">{item.bestTimeToPost}</Text>
      </View>

      <View className="h-px bg-gray-100 mb-3" />

      {/* Actions */}
      <View className="flex-row" style={{ gap: 8 }}>
        <TouchableOpacity
          className="flex-1 border border-gray-200 rounded-xl py-2.5 items-center flex-row justify-center"
          style={{ gap: 4 }}
          onPress={onCopy}
        >
          <MaterialIcons name="content-copy" size={14} color="#374151" />
          <Text className="text-sm font-medium text-gray-700">Sao chép</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 border border-gray-200 rounded-xl py-2.5 items-center flex-row justify-center"
          style={{ gap: 4 }}
          onPress={onShare}
        >
          <MaterialIcons name="share" size={14} color="#374151" />
          <Text className="text-sm font-medium text-gray-700">Chia sẻ</Text>
        </TouchableOpacity>
      </View>

      {/* Image banner shortcut */}
      <TouchableOpacity
        className="mt-2 border border-gray-200 bg-gray-50 rounded-xl py-2.5 items-center flex-row justify-center"
        style={{ gap: 6 }}
        onPress={onImage}
        activeOpacity={0.7}
      >
        <MaterialIcons name="image" size={15} color="#374151" />
        <Text className="text-sm font-medium text-gray-700">Tạo ảnh banner</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GenerateResultScreen() {
  const router = useRouter();
  const { generatedItems, selectedTrendTitle, smartMatchReason, clearResult } = useContentStore();

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const handleCopy = async (item: GeneratedContentItem) => {
    const text = [
      item.hook,
      '',
      item.body,
      '',
      item.cta,
      '',
      item.hashtags.map((h) => `#${h}`).join(' '),
    ].join('\n');
    await Clipboard.setStringAsync(text);
    showToast('Đã sao chép');
  };

  const handleShare = async (item: GeneratedContentItem) => {
    const text = [
      item.hook,
      '',
      item.body,
      '',
      item.cta,
      '',
      item.hashtags.map((h) => `#${h}`).join(' '),
    ].join('\n');
    await Share.share({ message: text });
  };

  const handleBack = () => {
    clearResult();
    router.back();
  };

  if (!generatedItems || generatedItems.length === 0) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-gray-400 text-center">Không có nội dung nào được tạo.</Text>
        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="text-primary-500 font-medium">← Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Toast
        message={toastMessage}
        type="success"
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />

      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={handleBack}>
          <Text className="text-primary-500 font-medium">← Tạo lại</Text>
        </TouchableOpacity>
        <Text className="text-base font-bold text-gray-900">Kết quả</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* TrendBased info */}
      {selectedTrendTitle && (
        <View className="mx-5 mb-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <Text className="text-xs font-semibold text-gray-700 mb-0.5">
            {selectedTrendTitle}
          </Text>
          {smartMatchReason ? (
            <Text className="text-xs text-gray-500">{smartMatchReason}</Text>
          ) : null}
        </View>
      )}

      {/* Dot indicators */}
      <View className="flex-row justify-center mb-3" style={{ gap: 6 }}>
        {generatedItems.map((_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${
              i === activeIndex ? 'bg-primary-500 w-5' : 'bg-gray-200 w-2'
            }`}
          />
        ))}
      </View>

      {/* Swipeable cards — horizontal FlatList with snap */}
      <FlatList
        data={generatedItems}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_WIDTH - 40 + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(
            e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40 + 12)
          );
          setActiveIndex(index);
        }}
        renderItem={({ item, index }) => (
          <ContentCard
            item={item}
            index={index}
            total={generatedItems.length}
            onCopy={() => handleCopy(item)}
            onShare={() => handleShare(item)}
            onImage={() =>
              router.push({
                pathname: '/(tabs)/generate/image',
                params: {
                  // Encode \n thành \\n để truyền qua Expo Router params an toàn
                  contentText: [item.hook, item.body, item.cta].join('\\n\\n'),
                  platform: item.platform,
                  // Truyền bannerImagePrompt để dùng làm draftPrompt khi analyze
                  bannerImagePrompt: item.bannerImagePrompt ?? '',
                },
              })
            }
          />
        )}
      />

      {/* Brand Alignment shortcut */}
      <View className="px-5 pb-8 pt-4">
        <TouchableOpacity
          className="border border-gray-200 rounded-xl py-3 items-center flex-row justify-center"
          style={{ gap: 6 }}
          onPress={() => router.push('/(tabs)/generate/alignment')}
        >
          <MaterialIcons name="verified" size={15} color="#374151" />
          <Text className="text-gray-700 font-medium text-sm">Kiểm tra Brand Alignment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
