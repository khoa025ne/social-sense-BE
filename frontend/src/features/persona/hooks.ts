import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPersona, updatePersona } from './api';
import { useAuthStore } from '@/features/auth/store';
import { Config } from '@/constants/config';
import type { UpdatePersonaRequest } from '@/types/api';

export const personaKeys = {
  persona: ['persona'] as const,
};

// ─── usePersona ───────────────────────────────────────────────────────────────

export function usePersona() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: personaKeys.persona,
    queryFn: getPersona,
    enabled: isAuthenticated,
    staleTime: Config.QUERY.STALE_TIME,
  });
}

// ─── useUpdatePersona ─────────────────────────────────────────────────────────

export function useUpdatePersona() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdatePersonaRequest) => updatePersona(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: personaKeys.persona });
    },
  });
}
