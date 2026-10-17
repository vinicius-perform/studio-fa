// src/types/domain/brand.ts
import { z } from 'zod';
import type { Database } from '@/types/database';

export const BrandColorsSchema = z.object({
  primary: z.array(z.string()).default([]),
  secondary: z.array(z.string()).default([]),
  accent: z.array(z.string()).default([]),
  background: z.array(z.string()).default([]),
  text: z.array(z.string()).default([]),
});

export const BrandTypographySchema = z.object({
  headingStyle: z.string().optional(),
  bodyStyle: z.string().optional(),
  hierarchy: z.string().optional(),
  detectedFonts: z.array(z.string()).optional(),
  fallbackFonts: z.array(z.string()).optional(),
});

export const BrandCompositionSchema = z.object({
  alignment: z.string().optional(),
  density: z.string().optional(),
  margins: z.string().optional(),
  visualHierarchy: z.string().optional(),
  commonLayouts: z.array(z.string()).optional(),
});

export const BrandPhotographySchema = z.object({
  style: z.string().optional(),
  lighting: z.string().optional(),
  treatment: z.string().optional(),
  subjects: z.array(z.string()).optional(),
});

export const BrandLogoUsageSchema = z.object({
  preferredPositions: z.array(z.string()).optional(),
  minimumClearSpace: z.string().optional(),
  allowedVersions: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
});

export const BrandGraphicalElementsSchema = z.object({
  shapes: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  textures: z.array(z.string()).optional(),
  icons: z.array(z.string()).optional(),
  effects: z.array(z.string()).optional(),
});

export const BrandVisualStyleSchema = z.object({
  keywords: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  sophistication: z.string().optional(),
  contrast: z.string().optional(),
});

export const BrandContentStyleSchema = z.object({
  titleStyle: z.string().optional(),
  subtitleStyle: z.string().optional(),
  ctaStyle: z.string().optional(),
  amountOfText: z.string().optional(),
});

export const BrandProfileSchema = z.object({
  summary: z.string().min(1, 'Resumo do perfil é obrigatório'),
  colors: BrandColorsSchema,
  typography: BrandTypographySchema,
  composition: BrandCompositionSchema,
  photography: BrandPhotographySchema,
  logoUsage: BrandLogoUsageSchema,
  graphicalElements: BrandGraphicalElementsSchema,
  visualStyle: BrandVisualStyleSchema,
  contentStyle: BrandContentStyleSchema,
  spacingRules: z.array(z.string()).optional(),
  dos: z.array(z.string()).default([]),
  donts: z.array(z.string()).default([]),
});

export type BrandColors = z.infer<typeof BrandColorsSchema>;
export type BrandTypography = z.infer<typeof BrandTypographySchema>;
export type BrandComposition = z.infer<typeof BrandCompositionSchema>;
export type BrandPhotography = z.infer<typeof BrandPhotographySchema>;
export type BrandLogoUsage = z.infer<typeof BrandLogoUsageSchema>;
export type BrandGraphicalElements = z.infer<typeof BrandGraphicalElementsSchema>;
export type BrandVisualStyle = z.infer<typeof BrandVisualStyleSchema>;
export type BrandContentStyle = z.infer<typeof BrandContentStyleSchema>;
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export type BrandProfileRow = Database['public']['Tables']['brand_profiles']['Row'];
export type BrandReferenceRow = Database['public']['Tables']['brand_references']['Row'];

export const CreateBrandReferenceSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  asset_id: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  reference_type: z.enum([
    'instagram_post',
    'carousel',
    'story',
    'advertisement',
    'cover',
    'branding',
    'other',
  ]),
  tags: z.array(z.string()).default([]),
  ai_description: z.string().optional(),
  visual_features: z.record(z.unknown()).default({}),
  quality_score: z.number().min(0).max(1).optional(),
  is_approved: z.boolean().default(true),
});

export type CreateBrandReferenceInput = z.infer<typeof CreateBrandReferenceSchema>;
