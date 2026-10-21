// src/types/domain/creative-engine.ts
import { z } from 'zod';
import type { PieceAnalysis } from './piece';

/**
 * Coordenadas normalizadas para zonas de segurança e reserva de espaço negativo (0.0 a 1.0)
 */
export const NormalizedRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  })
  .refine((val) => val.x + val.width <= 1.001, {
    message: 'x + width não pode ultrapassar os limites do canvas (1.0)',
  })
  .refine((val) => val.y + val.height <= 1.001, {
    message: 'y + height não pode ultrapassar os limites do canvas (1.0)',
  });

export type NormalizedRect = z.infer<typeof NormalizedRectSchema>;

export const SlideSafeZonesSchema = z.object({
  headlineZone: NormalizedRectSchema,
  supportZone: NormalizedRectSchema.optional(),
  ctaZone: NormalizedRectSchema.optional(),
  logoZone: NormalizedRectSchema.optional(),
});

export type SlideSafeZones = z.infer<typeof SlideSafeZonesSchema>;

/**
 * Perfis de Geração Econômica e Final
 */
export type GenerationProfileType = 'SMOKE' | 'FINAL';

export interface GenerationProfileConfig {
  profile: GenerationProfileType;
  model: string;
  quality: 'low' | 'medium' | 'high';
  n: number;
  partialImages: number;
}

export const GENERATION_PROFILES: Record<GenerationProfileType, GenerationProfileConfig> = {
  SMOKE: {
    profile: 'SMOKE',
    model: 'gpt-image-2.5-flare',
    quality: 'low',
    n: 1,
    partialImages: 0,
  },
  FINAL: {
    profile: 'FINAL',
    model: 'gpt-image-2.5-sunburst',
    quality: 'high',
    n: 1,
    partialImages: 0,
  },
};

/**
 * Resoluções oficiais do GPT Image compatíveis com múltiplos de 16
 */
export interface AspectRatioResolution {
  aspectRatio: string;
  generationWidth: number;
  generationHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const GPT_IMAGE_RESOLUTIONS: Record<string, AspectRatioResolution> = {
  '4:5': {
    aspectRatio: '4:5',
    generationWidth: 1024,
    generationHeight: 1280,
    canvasWidth: 1080,
    canvasHeight: 1350,
  },
  '9:16': {
    aspectRatio: '9:16',
    generationWidth: 1008,
    generationHeight: 1792,
    canvasWidth: 1080,
    canvasHeight: 1920,
  },
  '1:1': {
    aspectRatio: '1:1',
    generationWidth: 1024,
    generationHeight: 1024,
    canvasWidth: 1080,
    canvasHeight: 1080,
  },
  '16:9': {
    aspectRatio: '16:9',
    generationWidth: 1792,
    generationHeight: 1008,
    canvasWidth: 1920,
    canvasHeight: 1080,
  },
};

/**
 * Contexto de Marca Compacto determinístico (sem chamadas extras de IA)
 */
export const CompactBrandContextSchema = z.object({
  mood: z.array(z.string()).default([]),
  palette: z.object({
    primary: z.array(z.string()).default([]),
    secondary: z.array(z.string()).default([]),
    accent: z.array(z.string()).default([]),
    background: z.array(z.string()).default([]),
  }),
  typographyCharacter: z.string().default('Clean and modern typography with high contrast'),
  imagery: z.object({
    imageType: z.string().optional(),
    treatment: z.string().optional(),
    lighting: z.string().optional(),
  }),
  composition: z.object({
    layoutDensity: z.string().optional(),
    negativeSpacePreference: z.string().optional(),
  }),
  doRules: z.array(z.string()).default([]),
  dontRules: z.array(z.string()).default([]),
  logoBehavior: z.string().default('Official logo kept in dedicated safe area'),
  manualRules: z.array(z.string()).default([]),
});

export type CompactBrandContext = z.infer<typeof CompactBrandContextSchema>;

/**
 * Referência visual selecionada com metadados para envio de pixels
 */
export const SelectedReferencePieceSchema = z.object({
  pieceId: z.string().uuid(),
  title: z.string().optional(),
  storageBucket: z.string(),
  storagePath: z.string(),
  isPrimary: z.boolean().default(false),
  analysis: z.any().optional(), // PieceAnalysis
});

export type SelectedReferencePiece = z.infer<typeof SelectedReferencePieceSchema>;

/**
 * Creative Context: Ponto único da verdade antes do planejamento de cada lâmina
 */
export const CreativeContextSchema = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  clientNiche: z.string().nullable().optional(),
  format: z.object({
    id: z.string(),
    name: z.string(),
    aspectRatio: z.string(),
    generationWidth: z.number(),
    generationHeight: z.number(),
    exportWidth: z.number(),
    exportHeight: z.number(),
  }),
  exactContent: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    body: z.string().optional(),
    cta: z.string().optional(),
    userVisualDirection: z.string().optional(),
  }),
  manualRules: z.array(z.string()).default([]),
  compactBrandContext: CompactBrandContextSchema,
  currentDnaVersionId: z.string().uuid().nullable().optional(),
  brandAssets: z.object({
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    primaryFont: z.string().optional(),
  }),
  selectedReferences: z.array(SelectedReferencePieceSchema).default([]),
});

export type CreativeContext = z.infer<typeof CreativeContextSchema>;

/**
 * Generated Asset: Metadados do ativo visual gerado persistido em storage e DB
 */
export const GeneratedAssetSchema = z.object({
  id: z.string(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  projectId: z.string(),
  slideId: z.string(),
  storageBucket: z.string(),
  storagePath: z.string(),
  publicOrSignedUrl: z.string(),
  provider: z.enum(['openai', 'fake']),
  model: z.string(),
  generationProfile: z.enum(['SMOKE', 'FINAL']),
  quality: z.string(),
  width: z.number(),
  height: z.number(),
  promptVersion: z.string(),
  status: z.enum(['completed', 'failed']),
  createdAt: z.string(),
});

export type GeneratedAsset = z.infer<typeof GeneratedAssetSchema>;
