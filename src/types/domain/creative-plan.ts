// src/types/domain/creative-plan.ts
import { z } from 'zod';
import type { Database } from '@/types/database';

export const GlobalCreativeDirectionSchema = z.object({
  concept: z.string(),
  visualRhythm: z.string(),
  backgroundStyle: z.string(),
  photographyStyle: z.string(),
  graphicLanguage: z.array(z.string()).default([]),
  consistencyRules: z.array(z.string()).default([]),
});

export const SlideLayoutCoordinatesSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1).optional(),
  align: z.enum(['left', 'center', 'right']).default('left'),
});

export const SlidePlanSchema = z.object({
  slideIndex: z.number().int().nonnegative(),
  slideType: z.enum(['cover', 'content', 'problem', 'solution', 'quote', 'cta', 'other']).default('content'),
  visualConcept: z.string(),
  imageStrategy: z.enum(['preserve_photo', 'edit_photo_ai', 'generate_new_image']),
  imagePrompt: z.string(),
  negativeSpace: z.string().default('Clean space on the left side for typographic headline'),
  layout: z.object({
    title: SlideLayoutCoordinatesSchema,
    subtitle: SlideLayoutCoordinatesSchema.optional(),
    body: SlideLayoutCoordinatesSchema.optional(),
    cta: SlideLayoutCoordinatesSchema.optional(),
    logo: SlideLayoutCoordinatesSchema.optional(),
  }),
  textHierarchy: z.string().default('H1 Dominant > Body Medium > CTA Subtle'),
  palette: z.array(z.string()).default([]),
  logoPlacement: z.string().default('top-left'),
  graphicElements: z.array(z.string()).default([]),
  referenceIds: z.array(z.string().uuid()).default([]),
});

export const ProjectCreativePlanSchema = z.object({
  globalDirection: GlobalCreativeDirectionSchema,
  slidePlans: z.array(SlidePlanSchema),
  selectedReferenceIds: z.array(z.string().uuid()).default([]),
});

export type GlobalCreativeDirection = z.infer<typeof GlobalCreativeDirectionSchema>;
export type SlidePlan = z.infer<typeof SlidePlanSchema>;
export type ProjectCreativePlan = z.infer<typeof ProjectCreativePlanSchema>;

export type ProjectCreativePlanRow = Database['public']['Tables']['project_creative_plans']['Row'];
