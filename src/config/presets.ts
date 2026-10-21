// src/config/presets.ts

export type AIPresetId = 'fast' | 'production' | 'premium';

export interface AIPresetDefinition {
  id: AIPresetId;
  name: string;
  description: string;
  model: string;
  quality: 'low' | 'medium' | 'high' | 'xhigh';
  estimatedCostPerImageUsd: number;
  timeoutMs: number;
  maxRetries: number;
}

export const AI_GENERATION_PRESETS: Record<AIPresetId, AIPresetDefinition> = {
  fast: {
    id: 'fast',
    name: 'Rápido',
    description: 'Testar conceito, baixa latência e menor custo',
    model: process.env.OPENAI_IMAGE_FAST_MODEL || 'gpt-image-2.5-flare',
    quality: 'low',
    estimatedCostPerImageUsd: 0.02,
    timeoutMs: 30000,
    maxRetries: 2,
  },
  production: {
    id: 'production',
    name: 'Produção (Padrão)',
    description: 'Equilíbrio ideal entre fidelidade visual e custo operacional',
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst',
    quality: 'high',
    estimatedCostPerImageUsd: 0.04,
    timeoutMs: 45000,
    maxRetries: 3,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Maior fidelidade fotográfica, acabamento de alta resolução',
    model: process.env.OPENAI_IMAGE_PREMIUM_MODEL || 'gpt-image-2.5-sunburst',
    quality: 'high',
    estimatedCostPerImageUsd: 0.08,
    timeoutMs: 60000,
    maxRetries: 3,
  },
};

export const AI_PRESETS = AI_GENERATION_PRESETS;
export const AI_MAX_CONCURRENCY = parseInt(process.env.AI_MAX_CONCURRENCY || '3', 10);

export function getPresetDefinition(presetId: AIPresetId): AIPresetDefinition {
  return AI_GENERATION_PRESETS[presetId] ?? AI_GENERATION_PRESETS.production;
}
