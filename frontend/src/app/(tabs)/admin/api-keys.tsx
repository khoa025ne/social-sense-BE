import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  useApiKeys,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
  useReloadApiKeyPool,
  useClearApiKeyCooldowns,
  useAdminModels,
} from '@/features/admin/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import type { ApiKeyItem, CreateApiKeyRequest, UpdateApiKeyRequest } from '@/types/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDERS = ['openrouter', 'groq', 'openai', 'gemini', 'huggingface', 'pollinations'] as const;
type Provider = (typeof PROVIDERS)[number];

const PROVIDER_COLORS: Record<Provider, { bg: string; text: string }> = {
  openrouter:   { bg: 'bg-violet-100', text: 'text-violet-700' },
  groq:         { bg: 'bg-orange-100', text: 'text-orange-700' },
  openai:       { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  gemini:       { bg: 'bg-blue-100', text: 'text-blue-700' },
  huggingface:  { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  pollinations: { bg: 'bg-pink-100', text: 'text-pink-700' },
};

function providerBadgeClasses(provider: string): { bg: string; text: string } {
  return PROVIDER_COLORS[provider as Provider] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
}

// ─── ProviderSelector ─────────────────────────────────────────────────────────

interface ProviderSelectorProps {
  value: string;
  onChange: (v: string) => void;
  onProviderChange?: (v: string, defaults: { model: string; imageGen: boolean }) => void;
}

function ProviderSelector({ value, onChange, onProviderChange }: ProviderSelectorProps) {
  return (
    <View>
      <Text className="text-xs text-gray-500 mb-1.5">Provider</Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {PROVIDERS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => {
              onChange(p);
              const defaults = DEFAULT_MODEL_BY_PROVIDER[p] ?? { model: '', imageGen: false };
              onProviderChange?.(p, defaults);
            }}
            className={`px-3 py-1.5 rounded-full border ${
              value === p
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white border-gray-200'
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-semibold ${
                value === p ? 'text-white' : 'text-gray-600'
              }`}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Hint cho provider đang chọn */}
      {value === 'pollinations' && (
        <Text className="text-xs text-pink-500 mt-1.5">🖼 Pollinations — Image only, đã bật Image Generation</Text>
      )}
      {value === 'huggingface' && (
        <Text className="text-xs text-yellow-600 mt-1.5">🤗 HuggingFace — Image only, đã bật Image Generation</Text>
      )}
      {value === 'groq' && (
        <Text className="text-xs text-orange-500 mt-1.5">⚡ Groq — Text only, FREE unlimited</Text>
      )}
    </View>
  );
}

// ─── Static model fallback (từ SETUP_AI_KEYS.md — dùng khi BE chưa trả về) ──

type ModelEntry = {
  provider: string;
  modelId: string;
  displayName: string;
  supportsImageGen: boolean;
  isFree: boolean;
  notes: string;
};

const STATIC_MODELS: ModelEntry[] = [
  // ── OpenRouter — Text FREE ────────────────────────────────────────────────
  { provider: 'openrouter', modelId: 'meta-llama/llama-4-scout',                    displayName: 'LLaMA 4 Scout',              supportsImageGen: false, isFree: true,  notes: 'Mặc định, nhanh' },
  { provider: 'openrouter', modelId: 'meta-llama/llama-4-maverick',                 displayName: 'LLaMA 4 Maverick',           supportsImageGen: false, isFree: true,  notes: 'Mạnh hơn Scout' },
  { provider: 'openrouter', modelId: 'google/gemini-2.0-flash-exp:free',            displayName: 'Gemini 2.0 Flash (free)',    supportsImageGen: false, isFree: true,  notes: 'Tiếng Việt xuất sắc' },
  { provider: 'openrouter', modelId: 'google/gemini-2.5-flash-preview:free',        displayName: 'Gemini 2.5 Flash (free)',    supportsImageGen: false, isFree: true,  notes: 'Preview mới nhất' },
  { provider: 'openrouter', modelId: 'deepseek/deepseek-r1:free',                   displayName: 'DeepSeek R1 (free)',         supportsImageGen: false, isFree: true,  notes: 'Reasoning tốt' },
  { provider: 'openrouter', modelId: 'deepseek/deepseek-chat-v3-0324:free',         displayName: 'DeepSeek Chat V3 (free)',    supportsImageGen: false, isFree: true,  notes: 'Chat nhanh' },
  { provider: 'openrouter', modelId: 'mistralai/mistral-7b-instruct:free',          displayName: 'Mistral 7B (free)',          supportsImageGen: false, isFree: true,  notes: 'Nhẹ, nhanh' },
  { provider: 'openrouter', modelId: 'qwen/qwen3-235b-a22b:free',                   displayName: 'Qwen3 235B (free)',          supportsImageGen: false, isFree: true,  notes: 'Đa ngôn ngữ tốt' },
  { provider: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free',      displayName: 'LLaMA 3.3 70B (free)',       supportsImageGen: false, isFree: true,  notes: 'Chất lượng cao' },
  // ── OpenRouter — Image FREE ───────────────────────────────────────────────
  { provider: 'openrouter', modelId: 'x-ai/grok-imagine-image-quality',             displayName: 'Grok Imagine (FREE 2K/4K)', supportsImageGen: true,  isFree: true,  notes: 'Ảnh photorealistic miễn phí' },
  // ── OpenRouter — Image Paid ───────────────────────────────────────────────
  { provider: 'openrouter', modelId: 'black-forest-labs/flux-schnell',              displayName: 'FLUX Schnell',               supportsImageGen: true,  isFree: false, notes: 'Nhanh, chất lượng cao' },
  { provider: 'openrouter', modelId: 'black-forest-labs/flux.2-klein-4b',           displayName: 'FLUX.2 Klein 4B',            supportsImageGen: true,  isFree: false, notes: 'Compact, hiệu quả' },
  { provider: 'openrouter', modelId: 'black-forest-labs/flux-1.1-pro',              displayName: 'FLUX 1.1 Pro',               supportsImageGen: true,  isFree: false, notes: 'Chất lượng cao nhất' },
  { provider: 'openrouter', modelId: 'openai/dall-e-3',                             displayName: 'DALL-E 3 (via OR)',          supportsImageGen: true,  isFree: false, notes: 'OpenAI qua OpenRouter' },
  // ── Groq — Text FREE ──────────────────────────────────────────────────────
  { provider: 'groq',       modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',   displayName: 'LLaMA 4 Scout 17B',         supportsImageGen: false, isFree: true,  notes: 'Nhanh nhất trên Groq' },
  { provider: 'groq',       modelId: 'llama-3.3-70b-versatile',                     displayName: 'LLaMA 3.3 70B Versatile',   supportsImageGen: false, isFree: true,  notes: 'Chất lượng cao' },
  { provider: 'groq',       modelId: 'llama-3.1-8b-instant',                        displayName: 'LLaMA 3.1 8B Instant',      supportsImageGen: false, isFree: true,  notes: 'Siêu nhanh' },
  { provider: 'groq',       modelId: 'qwen/qwen3-32b',                              displayName: 'Qwen3 32B',                  supportsImageGen: false, isFree: true,  notes: 'Đa ngôn ngữ' },
  // ── HuggingFace — Image FREE/Paid ────────────────────────────────────────
  { provider: 'huggingface', modelId: 'black-forest-labs/FLUX.1-schnell',           displayName: 'FLUX.1 Schnell (HF)',        supportsImageGen: true,  isFree: true,  notes: 'Miễn phí với HF token' },
  { provider: 'huggingface', modelId: 'black-forest-labs/FLUX.1-dev',               displayName: 'FLUX.1 Dev (HF)',            supportsImageGen: true,  isFree: false, notes: 'Cần HF Pro' },
  { provider: 'huggingface', modelId: 'stabilityai/stable-diffusion-xl-base-1.0',   displayName: 'SDXL Base (HF)',             supportsImageGen: true,  isFree: true,  notes: 'Stable Diffusion XL' },
  { provider: 'huggingface', modelId: 'stabilityai/sdxl-turbo',                     displayName: 'SDXL Turbo (HF)',            supportsImageGen: true,  isFree: true,  notes: 'Cực nhanh 1-step' },
  // ── OpenAI ────────────────────────────────────────────────────────────────
  { provider: 'openai',     modelId: 'gpt-4o-mini',                                 displayName: 'GPT-4o Mini',                supportsImageGen: false, isFree: false, notes: 'Nhanh, giá rẻ' },
  { provider: 'openai',     modelId: 'gpt-4o',                                      displayName: 'GPT-4o',                     supportsImageGen: false, isFree: false, notes: 'Chất lượng cao nhất' },
  { provider: 'openai',     modelId: 'dall-e-3',                                    displayName: 'DALL-E 3',                   supportsImageGen: true,  isFree: false, notes: 'Ảnh chất lượng cao' },
  // ── Pollinations ─────────────────────────────────────────────────────────
  { provider: 'pollinations', modelId: 'flux',                                      displayName: 'Flux (Pollinations)',        supportsImageGen: true,  isFree: true,  notes: 'Miễn phí, không cần key' },
];

// ─── ModelSuggestInput ────────────────────────────────────────────────────────

interface ModelSuggestInputProps {
  value: string;
  onChange: (v: string) => void;
  provider: string;
  suggestions: Array<{ modelId: string; displayName: string; provider: string }>;
}

function ModelSuggestInput({ value, onChange, provider, suggestions }: ModelSuggestInputProps) {
  const [showAll, setShowAll] = useState(false);

  // Merge: ưu tiên suggestions từ API, fallback về STATIC_MODELS
  const merged: ModelEntry[] = suggestions.length > 0
    ? suggestions.map((s) => {
        const found = STATIC_MODELS.find((m) => m.modelId === s.modelId);
        return found ?? { ...s, supportsImageGen: false, isFree: false, notes: '' };
      })
    : STATIC_MODELS;

  const filtered = merged.filter((m) => m.provider === provider);
  const visible = showAll ? filtered : filtered.slice(0, 6);

  return (
    <View>
      <Text className="text-xs text-gray-500 mb-1.5">Model Override (tùy chọn)</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="VD: meta-llama/llama-4-scout"
        className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 mb-2"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {filtered.length > 0 && (
        <View style={{ gap: 6 }}>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {visible.map((m) => (
              <TouchableOpacity
                key={m.modelId}
                onPress={() => onChange(m.modelId)}
                activeOpacity={0.7}
                className={`flex-row items-center px-2.5 py-1.5 rounded-lg border ${
                  value === m.modelId
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {/* FREE tag */}
                {m.isFree && (
                  <View className="bg-green-100 px-1 py-0.5 rounded mr-1">
                    <Text className="text-[9px] text-green-700 font-bold">FREE</Text>
                  </View>
                )}
                {/* Image tag */}
                {m.supportsImageGen && (
                  <View className="bg-purple-100 px-1 py-0.5 rounded mr-1">
                    <Text className="text-[9px] text-purple-700 font-bold">IMG</Text>
                  </View>
                )}
                <Text
                  className={`text-xs font-medium ${
                    value === m.modelId ? 'text-white' : 'text-gray-700'
                  }`}
                  numberOfLines={1}
                >
                  {m.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Show more / less */}
          {filtered.length > 6 && (
            <TouchableOpacity onPress={() => setShowAll((p) => !p)} activeOpacity={0.7}>
              <Text className="text-xs text-primary-500 font-medium">
                {showAll ? '▲ Rút gọn' : `▼ Xem thêm ${filtered.length - 6} model`}
              </Text>
            </TouchableOpacity>
          )}
          {/* notes của model đang chọn */}
          {value && (() => {
            const selected = filtered.find((m) => m.modelId === value);
            return selected?.notes ? (
              <Text className="text-xs text-gray-400 italic">{selected.notes}</Text>
            ) : null;
          })()}
        </View>
      )}
    </View>
  );
}

// ─── KeyFormFields ────────────────────────────────────────────────────────────
// Shared form fields used by both Add and Edit modals.

interface KeyFormState {
  label: string;
  keyValue: string;
  provider: string;
  modelOverride: string;
  supportsImageGen: boolean;
  notes: string;
}

interface KeyFormFieldsProps {
  state: KeyFormState;
  onChange: (patch: Partial<KeyFormState>) => void;
  showKeyField: boolean;
  modelSuggestions: Array<{ modelId: string; displayName: string; provider: string }>;
}

function KeyFormFields({ state, onChange, showKeyField, modelSuggestions }: KeyFormFieldsProps) {
  return (
    <View style={{ gap: 12 }}>
      {/* Label */}
      <View>
        <Text className="text-xs text-gray-500 mb-1.5">Nhãn *</Text>
        <TextInput
          value={state.label}
          onChangeText={(v) => onChange({ label: v })}
          placeholder="VD: OpenRouter Key 1"
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800"
        />
      </View>

      {/* Key value */}
      {showKeyField && (
        <View>
          <Text className="text-xs text-gray-500 mb-1.5">API Key *</Text>
          <TextInput
            value={state.keyValue}
            onChangeText={(v) => {
              onChange({ keyValue: v });
              // Auto-detect provider từ key prefix
              if (v.startsWith('sk_') && state.provider !== 'pollinations') {
                onChange({ keyValue: v, provider: 'pollinations', supportsImageGen: true });
              } else if (v.startsWith('hf_') && state.provider !== 'huggingface') {
                onChange({ keyValue: v, provider: 'huggingface', supportsImageGen: true });
              }
            }}
            placeholder="sk-or-v1-... / gsk_... / sk_..."
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {state.keyValue.startsWith('sk_') && (
            <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
              <Text className="text-xs">🖼</Text>
              <Text className="text-xs text-pink-600 font-medium">
                Pollinations key — đã tự động bật Image Generation
              </Text>
            </View>
          )}
          {state.keyValue.startsWith('hf_') && (
            <View className="flex-row items-center mt-1.5" style={{ gap: 4 }}>
              <Text className="text-xs">🤗</Text>
              <Text className="text-xs text-yellow-600 font-medium">
                HuggingFace key — đã tự động bật Image Generation
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Provider */}
      <ProviderSelector
        value={state.provider}
        onChange={(v) => onChange({ provider: v })}
        onProviderChange={(_v, defaults) => {
          // Chỉ auto-fill model nếu field đang trống hoặc là default của provider cũ
          const currentIsDefault = Object.values(DEFAULT_MODEL_BY_PROVIDER)
            .some(d => d.model === state.modelOverride);
          if (!state.modelOverride || currentIsDefault) {
            onChange({ modelOverride: defaults.model });
          }
          // Luôn auto-set supportsImageGen khi đổi provider
          onChange({ supportsImageGen: defaults.imageGen });
        }}
      />

      {/* Model override */}
      <ModelSuggestInput
        value={state.modelOverride}
        onChange={(v) => onChange({ modelOverride: v })}
        provider={state.provider}
        suggestions={modelSuggestions}
      />

      {/* Supports image gen */}
      <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <View>
          <Text className="text-sm font-medium text-gray-800">Hỗ trợ tạo ảnh</Text>
          <Text className="text-xs text-gray-400">Key này có thể generate image</Text>
        </View>
        <Switch
          value={state.supportsImageGen}
          onValueChange={(v) => onChange({ supportsImageGen: v })}
          trackColor={{ false: '#E5E7EB', true: '#111827' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Notes */}
      <View>
        <Text className="text-xs text-gray-500 mb-1.5">Ghi chú (tùy chọn)</Text>
        <TextInput
          value={state.notes}
          onChangeText={(v) => onChange({ notes: v })}
          placeholder="Ghi chú thêm..."
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800"
        />
      </View>
    </View>
  );
}

// ─── AddKeyModal ──────────────────────────────────────────────────────────────

interface AddKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateApiKeyRequest) => void;
  isLoading: boolean;
  modelSuggestions: Array<{ modelId: string; displayName: string; provider: string }>;
}

const EMPTY_ADD_FORM: KeyFormState = {
  label: '', keyValue: '', provider: 'openrouter',
  modelOverride: '', supportsImageGen: false, notes: '',
};

function AddKeyModal({ visible, onClose, onSubmit, isLoading, modelSuggestions }: AddKeyModalProps) {
  const [form, setForm] = useState<KeyFormState>(EMPTY_ADD_FORM);

  const patch = useCallback((p: Partial<KeyFormState>) => setForm((prev) => ({ ...prev, ...p })), []);

  const handleClose = () => { setForm(EMPTY_ADD_FORM); onClose(); };

  const handleSubmit = () => {
    if (!form.label.trim() || !form.keyValue.trim()) return;
    onSubmit({
      label: form.label.trim(),
      keyValue: form.keyValue.trim(),
      provider: form.provider,
      modelOverride: form.modelOverride.trim() || undefined,
      supportsImageGen: form.supportsImageGen,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Thêm API Key</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-gray-400 text-2xl leading-none">×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            <KeyFormFields
              state={form}
              onChange={patch}
              showKeyField
              modelSuggestions={modelSuggestions}
            />
            <View className="mt-4">
              <Button variant="primary" onPress={handleSubmit} loading={isLoading}>
                Thêm key
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── EditKeyModal ─────────────────────────────────────────────────────────────

interface EditKeyModalProps {
  item: ApiKeyItem | null;
  onClose: () => void;
  onSubmit: (id: number, data: UpdateApiKeyRequest) => void;
  isLoading: boolean;
  modelSuggestions: Array<{ modelId: string; displayName: string; provider: string }>;
}

function EditKeyModal({ item, onClose, onSubmit, isLoading, modelSuggestions }: EditKeyModalProps) {
  const [form, setForm] = useState<KeyFormState>(EMPTY_ADD_FORM);

  // Sync form when item changes
  useEffect(() => {
    if (item) {
      setForm({
        label: item.label,
        keyValue: '',
        provider: item.provider,
        modelOverride: item.modelOverride ?? '',
        supportsImageGen: item.supportsImageGen,
        notes: item.notes ?? '',
      });
    }
  }, [item]);

  const patch = useCallback((p: Partial<KeyFormState>) => setForm((prev) => ({ ...prev, ...p })), []);

  if (!item) return null;

  const handleSubmit = () => {
    if (!form.label.trim()) return;
    const data: UpdateApiKeyRequest = {
      label: form.label.trim(),
      provider: form.provider,
      modelOverride: form.modelOverride.trim() || undefined,
      supportsImageGen: form.supportsImageGen,
      notes: form.notes.trim() || undefined,
    };
    if (form.keyValue.trim()) data.keyValue = form.keyValue.trim();
    onSubmit(item.id, data);
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Sửa API Key</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-gray-400 text-2xl leading-none">×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            <KeyFormFields
              state={form}
              onChange={patch}
              showKeyField
              modelSuggestions={modelSuggestions}
            />
            <View className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
              <Text className="text-xs text-amber-700">
                Để trống trường API Key nếu không muốn thay đổi giá trị key.
              </Text>
            </View>
            <View className="mt-4">
              <Button variant="primary" onPress={handleSubmit} loading={isLoading}>
                Lưu thay đổi
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── ApiKeyCard ───────────────────────────────────────────────────────────────

interface ApiKeyCardProps {
  item: ApiKeyItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ApiKeyCard({ item, onToggle, onEdit, onDelete }: ApiKeyCardProps) {
  return (
    <Card variant="outlined" className="mb-3">
      {/* Top row: label + status indicators */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <View className="flex-row items-center flex-wrap" style={{ gap: 6, marginBottom: 4 }}>
            <Text className="text-sm font-semibold text-gray-900">{item.label}</Text>
            {item.isEncrypted && (
              <MaterialIcons name="lock" size={12} color="#9CA3AF" />
            )}
          </View>
          <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
            {/* Provider badge */}
            {(() => {
              const cls = providerBadgeClasses(item.provider);
              return (
                <View className={`px-2 py-0.5 rounded-full ${cls.bg}`}>
                  <Text className={`text-xs font-medium ${cls.text}`}>
                    {item.provider}
                  </Text>
                </View>
              );
            })()}
            {/* Key suffix */}
            <Text className="text-xs text-gray-400 font-mono">****{item.keySuffix}</Text>
            {/* Image gen badge */}
            {item.supportsImageGen && (
              <View className="bg-purple-100 px-2 py-0.5 rounded-full">
                <Text className="text-xs text-purple-700 font-medium">Ảnh</Text>
              </View>
            )}
          </View>
          {/* Model override */}
          {item.modelOverride ? (
            <Text className="text-xs text-gray-400 mt-1" numberOfLines={1}>
              Model: {item.modelOverride}
            </Text>
          ) : null}
        </View>

        {/* Active dot + cooldown */}
        <View className="items-end" style={{ gap: 4 }}>
          <View className={`w-2.5 h-2.5 rounded-full ${item.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
          {item.isInCooldown && (
            <View className="bg-amber-100 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-amber-700">Cooldown</Text>
            </View>
          )}
        </View>
      </View>

      {item.notes ? (
        <Text className="text-xs text-gray-400 mb-2">{item.notes}</Text>
      ) : null}

      {/* Actions */}
      <View className="flex-row mt-1" style={{ gap: 8 }}>
        <TouchableOpacity
          onPress={onToggle}
          className={`flex-1 py-2 rounded-lg border ${
            item.isActive ? 'border-gray-200 bg-gray-50' : 'border-primary-200 bg-primary-50'
          }`}
          activeOpacity={0.7}
        >
          <Text className={`text-xs text-center font-medium ${item.isActive ? 'text-gray-600' : 'text-primary-600'}`}>
            {item.isActive ? 'Tắt' : 'Bật'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onEdit}
          className="flex-1 py-2 rounded-lg border border-primary-200 bg-primary-50"
          activeOpacity={0.7}
        >
          <Text className="text-xs text-center font-medium text-primary-600">Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          className="flex-1 py-2 rounded-lg border border-red-200 bg-red-50"
          activeOpacity={0.7}
        >
          <Text className="text-xs text-center font-medium text-red-600">Xóa</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ─── ApiKeysScreen ────────────────────────────────────────────────────────────

export default function ApiKeysScreen() {
  const router = useRouter();
  const { data: keys, isLoading } = useApiKeys();
  const { data: modelsData } = useAdminModels();
  const { mutate: createKey, isPending: isCreating } = useCreateApiKey();
  const { mutate: updateKey, isPending: isUpdating } = useUpdateApiKey();
  const { mutate: deleteKey } = useDeleteApiKey();
  const { mutate: reloadPool, isPending: isReloading } = useReloadApiKeyPool();
  const { mutate: clearCooldowns, isPending: isClearing } = useClearApiKeyCooldowns();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiKeyItem | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false, message: '', type: 'success',
  });

  const allModels = modelsData?.allModels ?? [];
  const modelSuggestions = allModels.map((m) => ({
    modelId: m.modelId,
    displayName: m.displayName,
    provider: m.provider,
  }));

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);
  const hideToast = useCallback(() => setToast((p) => ({ ...p, visible: false })), []);

  const handleAddKey = useCallback(
    (data: CreateApiKeyRequest) => {
      createKey(data, {
        onSuccess: () => { setShowAddModal(false); showToast('Đã thêm API key'); },
        onError: () => showToast('Thêm key thất bại', 'error'),
      });
    },
    [createKey, showToast]
  );

  const handleEditKey = useCallback(
    (id: number, data: UpdateApiKeyRequest) => {
      updateKey({ id, data }, {
        onSuccess: () => { setEditingItem(null); showToast('Đã cập nhật key'); },
        onError: () => showToast('Cập nhật thất bại', 'error'),
      });
    },
    [updateKey, showToast]
  );

  const handleToggle = useCallback(
    (item: ApiKeyItem) => {
      updateKey(
        { id: item.id, data: { isActive: !item.isActive } },
        {
          onSuccess: () => showToast(item.isActive ? 'Đã tắt key' : 'Đã bật key'),
          onError: () => showToast('Thao tác thất bại', 'error'),
        }
      );
    },
    [updateKey, showToast]
  );

  const handleDelete = useCallback(
    (item: ApiKeyItem) => {
      Alert.alert('Xóa API Key', `Xóa key "${item.label}"?`, [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: () =>
            deleteKey(item.id, {
              onSuccess: () => showToast('Đã xóa key'),
              onError: () => showToast('Xóa thất bại', 'error'),
            }),
        },
      ]);
    },
    [deleteKey, showToast]
  );

  const handleReload = useCallback(() => {
    reloadPool(false, {
      onSuccess: () => showToast('Đã reload key pool'),
      onError: () => showToast('Reload thất bại', 'error'),
    });
  }, [reloadPool, showToast]);

  const handleReloadClear = useCallback(() => {
    clearCooldowns(undefined, {
      onSuccess: (data) => showToast(`Đã xóa cooldown cho ${data.totalKeys} key`),
      onError: () => showToast('Xóa cooldown thất bại', 'error'),
    });
  }, [clearCooldowns, showToast]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      <AddKeyModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddKey}
        isLoading={isCreating}
        modelSuggestions={modelSuggestions}
      />
      <EditKeyModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditKey}
        isLoading={isUpdating}
        modelSuggestions={modelSuggestions}
      />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mr-3"
        >
          <Text className="text-primary-500 text-base font-medium">← Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 flex-1">API Keys</Text>
        <Button variant="primary" size="sm" onPress={() => setShowAddModal(true)}>
          + Thêm
        </Button>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Reload Pool */}
        <View className="mb-4 flex-row" style={{ gap: 8 }}>
          <View className="flex-1">
            <Button variant="outline" onPress={handleReload} loading={isReloading}>
              Reload Pool
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="outline" onPress={handleReloadClear} loading={isClearing}>
              Clear Cooldown
            </Button>
          </View>
        </View>

        {/* Stats */}
        {keys && (
          <View className="flex-row mb-4" style={{ gap: 12 }}>
            <View className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3">
              <Text className="text-xl font-bold text-green-700">
                {keys.filter((k) => k.isActive).length}
              </Text>
              <Text className="text-xs text-green-600">Đang hoạt động</Text>
            </View>
            <View className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Text className="text-xl font-bold text-amber-700">
                {keys.filter((k) => k.isInCooldown).length}
              </Text>
              <Text className="text-xs text-amber-600">Đang cooldown</Text>
            </View>
            <View className="flex-1 bg-purple-50 border border-purple-200 rounded-xl p-3">
              <Text className="text-xl font-bold text-purple-700">
                {keys.filter((k) => k.supportsImageGen).length}
              </Text>
              <Text className="text-xs text-purple-600">Hỗ trợ ảnh</Text>
            </View>
          </View>
        )}

        {/* Key List */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#111827" />
        ) : keys?.length === 0 ? (
          <View className="items-center py-12">
            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
              <MaterialIcons name="vpn-key" size={32} color="#6B7280" />
            </View>
            <Text className="text-gray-500">Chưa có API key nào</Text>
          </View>
        ) : (
          keys?.map((item) => (
            <ApiKeyCard
              key={item.id}
              item={item}
              onToggle={() => handleToggle(item)}
              onEdit={() => setEditingItem(item)}
              onDelete={() => handleDelete(item)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
