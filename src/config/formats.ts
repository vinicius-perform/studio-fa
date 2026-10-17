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

export const FORMATS = FORMAT_CONFIG;
export type FormatId = ProjectFormat;

export function getFormatDefinition(format: ProjectFormat): FormatDefinition {
  return FORMAT_CONFIG[format] ?? FORMAT_CONFIG.instagram_feed_4_5;
}
