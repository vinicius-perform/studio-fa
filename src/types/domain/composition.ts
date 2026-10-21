// src/types/domain/composition.ts
import { z } from 'zod';
import type { Database } from '@/types/database';

export type LayerType = 'background' | 'image' | 'text' | 'logo' | 'shape' | 'overlay';

export interface BaseLayer {
  id: string;
  type: LayerType;
  name: string;
  x: number; // Pixels relative to canvas resolution (e.g. 1080x1350)
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees (0-360)
  opacity?: number; // 0 to 1
  visible?: boolean;
  locked?: boolean;
  zIndex: number;
  lockAspectRatio?: boolean;
}

export interface ImageLayer extends BaseLayer {
  type: 'image' | 'background';
  imageUrl: string;
  assetId?: string;
  storagePath?: string;
  fit?: 'cover' | 'contain' | 'fill';
  crop?: { x: number; y: number; width: number; height: number };
  imageHistory?: {
    id: string;
    label: string;
    imageUrl: string;
    assetId?: string;
    createdAt: string;
  }[];
}

export type FontWeight =
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | 'normal'
  | 'bold'
  | number;

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: FontWeight;
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number; // multiplier, e.g. 1.2
  letterSpacing?: number; // px
  color: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  maxWidth?: number;
  maxLines?: number;
  overflowWarning?: boolean;
  semanticRole?: 'title' | 'subtitle' | 'body' | 'cta';
}

export interface LogoLayer extends BaseLayer {
  type: 'logo';
  assetId?: string;
  logoUrl: string;
  aspectRatio: number; // width / height
  variant?: 'primary' | 'secondary' | 'monochrome' | 'white' | 'dark';
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'line';
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface OverlayLayer extends BaseLayer {
  type: 'overlay';
  overlayType: 'solid' | 'gradient_top' | 'gradient_bottom' | 'gradient_radial';
  color: string;
  gradientStopColor?: string;
}

export type Layer = ImageLayer | TextLayer | LogoLayer | ShapeLayer | OverlayLayer;

export interface SlideDocument {
  version: number;
  canvas: {
    width: number;
    height: number;
    format: string;
    backgroundColor: string;
  };
  layers: Layer[];
  metadata?: {
    slideId?: string;
    projectId?: string;
    clientId?: string;
    pinnedReferenceIds?: string[];
  };
}

export type SlideCompositionRow = Database['public']['Tables']['slide_compositions']['Row'];

/**
 * Text auto-fit utility (Prompt Section 35)
 * If text exceeds bounding box, scales down font size progressively to minFontSize.
 * If it still overflows, returns overflowWarning = true.
 */
export function fitTextToBox(params: {
  text: string;
  fontSize: number;
  boxWidth: number;
  boxHeight: number;
  minFontSize?: number;
  lineHeight?: number;
}): { fontSize: number; overflowWarning: boolean } {
  const minFontSize = params.minFontSize ?? 16;
  const lineHeight = params.lineHeight ?? 1.25;

  let currentFontSize = params.fontSize;

  // Approximate character-width based on average proportional sans font (0.55 of font size)
  const charWidthRatio = 0.55;

  while (currentFontSize > minFontSize) {
    const approxCharWidth = currentFontSize * charWidthRatio;
    const maxCharsPerLine = Math.max(1, Math.floor(params.boxWidth / approxCharWidth));
    const words = params.text.split(/\s+/);

    let lineCount = 1;
    let currentLineLen = 0;

    for (const w of words) {
      if (currentLineLen + w.length + 1 > maxCharsPerLine) {
        lineCount++;
        currentLineLen = w.length;
      } else {
        currentLineLen += (currentLineLen === 0 ? 0 : 1) + w.length;
      }
    }

    const estimatedTotalHeight = lineCount * currentFontSize * lineHeight;
    if (estimatedTotalHeight <= params.boxHeight) {
      return { fontSize: currentFontSize, overflowWarning: false };
    }

    currentFontSize -= 2;
  }

  // If reached minFontSize and still exceeds height
  const approxCharWidth = minFontSize * charWidthRatio;
  const maxCharsPerLine = Math.max(1, Math.floor(params.boxWidth / approxCharWidth));
  const lineCount = Math.ceil(params.text.length / maxCharsPerLine);
  const isOverflow = lineCount * minFontSize * lineHeight > params.boxHeight;

  return { fontSize: minFontSize, overflowWarning: isOverflow };
}
