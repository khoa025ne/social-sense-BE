import { api } from "./client"

// ─── Types ───
export interface Persona {
  userId: number
  version: number
  language: string
  jobTitle: string
  toneOfVoice: string
  platformPreferences: string[]
  targetAudience: string[]
  contentFormats: string[]
  negativeConstraints: string[]
  updatedAt: string
}

export interface OnboardingRequest {
  language: string
  answers: string[]
}

export interface PersonaUpdateRequest {
  jobTitle?: string
  toneOfVoice?: string
  platformPreferences?: string[]
  targetAudience?: string[]
  contentFormats?: string[]
  negativeConstraints?: string[]
}

// ─── API calls ───
export const contextApi = {
  onboarding: (data: OnboardingRequest) =>
    api.post<{ personaVersion: number; status: string }>("/context/onboarding", data),

  getPersona: () =>
    api.get<Persona>("/context/persona"),

  updatePersona: (data: PersonaUpdateRequest) =>
    api.put<Persona>("/context/persona", data),
}
