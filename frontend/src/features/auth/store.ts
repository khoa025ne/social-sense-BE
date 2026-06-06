import { create } from 'zustand';
import type { Tier, AuthUser } from './types';
import type { LoginResponse } from '@/types/api';

interface AuthState {
  // State
  userId: number | null;
  email: string | null;
  displayName: string | null;
  roles: string[];
  tier: Tier | null;
  hasContext: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (data: LoginResponse) => void;
  clearAuth: () => void;
  setHasContext: (value: boolean) => void;
  setTier: (tier: Tier) => void;
  setRoles: (roles: string[]) => void;
  setLoading: (loading: boolean) => void;
  getUser: () => AuthUser | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  userId: null,
  email: null,
  displayName: null,
  roles: [],
  tier: null,
  hasContext: false,
  isAuthenticated: false,
  isLoading: true,

  // Actions
  setAuth: (data: LoginResponse) =>
    set({
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
      hasContext: data.hasContext,
      isAuthenticated: true,
      isLoading: false,
    }),

  clearAuth: () =>
    set({
      userId: null,
      email: null,
      displayName: null,
      roles: [],
      tier: null,
      hasContext: false,
      isAuthenticated: false,
      isLoading: false,
    }),

  setHasContext: (value: boolean) => set({ hasContext: value }),

  setTier: (tier: Tier) => set({ tier }),

  setRoles: (roles: string[]) => set({ roles }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  getUser: (): AuthUser | null => {
    const state = get();
    if (!state.isAuthenticated || !state.userId || !state.email || !state.displayName || !state.tier) {
      return null;
    }
    return {
      userId: state.userId,
      email: state.email,
      displayName: state.displayName,
      roles: state.roles,
      tier: state.tier,
      hasContext: state.hasContext,
    };
  },
}));
