import { create } from 'zustand';
import type { GenerateContentRequest, GeneratedContentItem } from '@/types/api';

interface ContentState {
  // State
  generationParams: GenerateContentRequest | null;
  generatedItems: GeneratedContentItem[] | null;
  selectedTrendTitle: string | null;
  smartMatchReason: string | null;
  isGenerating: boolean;

  // Actions
  setParams: (params: GenerateContentRequest) => void;
  setResult: (
    items: GeneratedContentItem[],
    trendTitle: string | null,
    matchReason: string
  ) => void;
  clearResult: () => void;
  setGenerating: (value: boolean) => void;
}

export const useContentStore = create<ContentState>((set) => ({
  generationParams: null,
  generatedItems: null,
  selectedTrendTitle: null,
  smartMatchReason: null,
  isGenerating: false,

  setParams: (params) => set({ generationParams: params }),

  setResult: (items, trendTitle, matchReason) =>
    set({
      generatedItems: items,
      selectedTrendTitle: trendTitle,
      smartMatchReason: matchReason,
      isGenerating: false,
    }),

  clearResult: () =>
    set({
      generatedItems: null,
      selectedTrendTitle: null,
      smartMatchReason: null,
      generationParams: null,
    }),

  setGenerating: (value) => set({ isGenerating: value }),
}));
