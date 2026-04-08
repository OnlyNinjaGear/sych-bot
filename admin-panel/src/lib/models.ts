export type ProviderId = 'google' | 'openrouter' | 'custom'

export interface ModelGroup {
  free: string[]
  paid: string[]
}

export const PROVIDERS: Record<ProviderId, { name: string; baseUrl: string; models: ModelGroup }> = {
  google: {
    name: 'Google (Gemini API)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    models: {
      free: [
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash-8b',
      ],
      paid: [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
      ],
    },
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: {
      free: [
        'google/gemma-3-27b-it:free',
        'google/gemini-2.0-flash-lite:free',
        'google/gemini-2.5-flash-lite-preview:free',
        'meta-llama/llama-3.1-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'qwen/qwq-32b:free',
        'deepseek/deepseek-r1:free',
      ],
      paid: [
        'google/gemini-2.5-flash',
        'google/gemini-2.5-pro',
        'google/gemini-2.0-flash',
        'anthropic/claude-3-5-haiku',
        'anthropic/claude-3-5-sonnet',
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
      ],
    },
  },
  custom: {
    name: 'Другой провайдер',
    baseUrl: '',
    models: { free: [], paid: [] },
  },
}

/** Google Native (Gemini SDK) — только для nativeModels */
export const NATIVE_MODELS: ModelGroup = {
  free: [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-8b',
  ],
  paid: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ],
}

export function detectProvider(baseUrl: string): ProviderId {
  if (baseUrl.includes('generativelanguage.googleapis.com')) return 'google'
  if (baseUrl.includes('openrouter.ai')) return 'openrouter'
  return 'custom'
}

export function allModels(group: ModelGroup): string[] {
  return [...group.free, ...group.paid]
}
