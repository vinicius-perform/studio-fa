// src/config/formats.ts
import type { ProjectFormat } from '@/types/database';

export interface FormatDefinition {
  id: ProjectFormat;
  name: string;
  description: string;
  exportWidth: number;
  exportHeight: number;
  generationWidth: number;
  generationHeight: number;
  aspectRatio: string;
  cropOffsetX?: number; // for Story (1088 -> 1080 is 8px crop, 4px each side)
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const FORMAT_CONFIG: Record<ProjectFormat, FormatDefinition> = {
  instagram_feed_4_5: {
    id: 'instagram_feed_4_5',
    name: 'Feed 4:5',
    description: '1080 × 1350 px (Padrão prioritário da FA)',
    exportWidth: 1080,
    exportHeight: 1350,
    generationWidth: 1088,
    generationHeight: 1360,
    aspectRatio: '4:5',
    safeArea: {
      top: 60,
      bottom: 80,
      left: 60,
      right: 60,
    },
  },
  instagram_square: {
    id: 'instagram_square',
    name: 'Quadrado',
    description: '1080 × 1080 px (1:1 clássico)',
    exportWidth: 1080,
    exportHeight: 1080,
    generationWidth: 1088,
    generationHeight: 1088,
    aspectRatio: '1:1',
    safeArea: {
      top: 60,
      bottom: 60,
      left: 60,
      right: 60,
    },
  },
  instagram_story: {
    id: 'instagram_story',
    name: 'Story 9:16',
    description: '1080 × 1920 px (Vertical tela cheia)',
    exportWidth: 1080,
    exportHeight: 1920,
    generationWidth: 1088,
    generationHeight: 1920,
    cropOffsetX: 4,
    aspectRatio: '9:16',
    safeArea: {
      top: 220, // Protege contra cabeçalho do Instagram
      bottom: 220, // Protege contra barra de resposta / compartilhamento
      left: 60,
      right: 60,
    },
  },
  custom: {
    id: 'custom',
    name: 'Personalizado',
    description: '1080 × 1350 px customizável',
    exportWidth: 1080,
    exportHeight: 1350,
    generationWidth: 1088,
    generationHeight: 1360,
    aspectRatio: 'custom',
    safeArea: {
      top: 60,
      bottom: 60,
      left: 60,
      right: 60,
    },
  },
};

export const MIN_CUSTOM_DIMENSION = 320;
export const MAX_CUSTOM_DIMENSION = 4096;

export interface GenerationSize {
  width: number;
  height: number;
}

export function resolveGenerationSizeForCanvas(width: number, height: number): GenerationSize {
  const safeW = Math.max(MIN_CUSTOM_DIMENSION, Math.min(MAX_CUSTOM_DIMENSION, width || 1080));
  const safeH = Math.max(MIN_CUSTOM_DIMENSION, Math.min(MAX_CUSTOM_DIMENSION, height || 1350));
  const ratio = safeW / safeH;

  if (ratio < 0.65) {
    // Vertical (Story 9:16 ratio ~0.56)
    return { width: 1088, height: 1920 };
  } else if (ratio < 0.9) {
    // Portrait (Feed 4:5 ratio ~0.8)
    return { width: 1088, height: 1360 };
  } else if (ratio <= 1.2) {
    // Square (1:1 ratio 1.0)
    return { width: 1088, height: 1088 };
  } else {
    // Landscape / Wide (16:9 ratio ~1.77)
    return { width: 1920, height: 1088 };
  }
}

export const FORMATS = FORMAT_CONFIG;
export type FormatId = ProjectFormat;

export function getFormatDefinition(
  format: ProjectFormat,
  customWidth?: number,
  customHeight?: number
): FormatDefinition {
  if (format === 'custom' && customWidth && customHeight) {
    const w = Math.max(MIN_CUSTOM_DIMENSION, Math.min(MAX_CUSTOM_DIMENSION, Math.round(customWidth)));
    const h = Math.max(MIN_CUSTOM_DIMENSION, Math.min(MAX_CUSTOM_DIMENSION, Math.round(customHeight)));
    const gen = resolveGenerationSizeForCanvas(w, h);
    return {
      id: 'custom',
      name: `Personalizado (${w} × ${h})`,
      description: `${w} × ${h} px personalizado`,
      exportWidth: w,
      exportHeight: h,
      generationWidth: gen.width,
      generationHeight: gen.height,
      aspectRatio: `${w}:${h}`,
      safeArea: {
        top: Math.round(h * 0.05),
        bottom: Math.round(h * 0.05),
        left: Math.round(w * 0.05),
        right: Math.round(w * 0.05),
      },
    };
  }
  return FORMAT_CONFIG[format] ?? FORMAT_CONFIG.instagram_feed_4_5;
}

