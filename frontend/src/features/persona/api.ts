import apiClient from '@/lib/api';
import type { PersonaProfile, UpdatePersonaRequest, OnboardingRequest, OnboardingResponse } from '@/types/api';

export async function getPersona(): Promise<PersonaProfile> {
  const res = await apiClient.get<PersonaProfile>('/context/persona');
  return res.data;
}

export async function updatePersona(data: UpdatePersonaRequest): Promise<{ message: string }> {
  const res = await apiClient.put<{ message: string }>('/context/persona', data);
  return res.data;
}

export async function submitOnboarding(data: OnboardingRequest): Promise<OnboardingResponse> {
  const res = await apiClient.post<OnboardingResponse>('/context/onboarding', data);
  return res.data;
}
