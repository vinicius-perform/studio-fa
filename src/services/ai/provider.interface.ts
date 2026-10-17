// src/services/ai/provider.interface.ts
import type { BrandProfile } from '@/types/domain/brand';

export interface AnalyzeImagesInput {
  imageUrls: string[];
  prompt?: string;
  context?: Record<string, unknown>;
}

export interface AnalyzeImagesOutput {
  description: string;
  detectedFeatures: Record<string, unknown>;
  visualStyle: {
    keywords: string[];
    mood: string[];
    sophistication: string;
    contrast: string;
  };
}

export interface AnalyzeBrandInput {
  brandName: string;
  referenceDescriptions: string[];
  referenceImages: string[];
  manualNotes?: string;
}

export interface CreateEmbeddingInput {
  text: string;
  model?: string;
}

export interface GenerateImageInput {
  prompt: string;
  brandProfile: BrandProfile;
  dimensions: { width: number; height: number };
  stylePreset?: string;
  negativePrompt?: string;
}

export interface EditImageInput {
  sourceImageUrl: string;
  instructionPrompt: string;
  brandProfile: BrandProfile;
  dimensions?: { width: number; height: number };
}

export interface GenerateImageOutput {
  imageUrl: string;
  model: string;
  revisedPrompt?: string;
  costUsd?: number;
}

export interface AIProvider {
  analyzeImages(params: AnalyzeImagesInput): Promise<AnalyzeImagesOutput>;
  analyzeBrand(params: AnalyzeBrandInput): Promise<BrandProfile>;
  createEmbedding(params: CreateEmbeddingInput): Promise<number[]>;
  generateImage(params: GenerateImageInput): Promise<GenerateImageOutput>;
  editImage(params: EditImageInput): Promise<GenerateImageOutput>;
}
