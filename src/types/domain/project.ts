// src/types/domain/project.ts
import { z } from 'zod';
import type { Database, ProjectType, ProjectStatus, ProjectFormat, SlideStatus } from '@/types/database';

export const CreateProjectSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  title: z.string().min(1, 'Título é obrigatório'),
  project_type: z.enum(['single_post', 'carousel']).default('single_post'),
  status: z
    .enum([
      'draft',
      'ready',
      'queued',
      'generating',
      'review',
      'changes_requested',
      'approved',
      'exporting',
      'exported',
      'failed',
      'archived',
    ])
    .default('draft'),
  format: z
    .enum(['instagram_feed_4_5', 'instagram_square', 'instagram_story', 'custom'])
    .default('instagram_feed_4_5'),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  generation_mode: z.string().nullable().optional(),
  brief: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const CreateSlideSchema = z.object({
  organization_id: z.string().uuid(),
  project_id: z.string().uuid(),
  slide_index: z.number().int().nonnegative(),
  slide_type: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  base_asset_id: z.string().uuid().nullable().optional(),
  status: z
    .enum(['draft', 'ready', 'generating', 'review', 'approved', 'failed'])
    .default('draft'),
  metadata: z.record(z.unknown()).default({}),
});

export const CreateProjectVersionSchema = z.object({
  organization_id: z.string().uuid(),
  project_id: z.string().uuid(),
  version_number: z.number().int().positive(),
  snapshot: z.record(z.unknown()),
  label: z.string().optional(),
});

export type CreateProjectInput = z.input<typeof CreateProjectSchema>;
export type CreateSlideInput = z.input<typeof CreateSlideSchema>;
export type CreateProjectVersionInput = z.input<typeof CreateProjectVersionSchema>;

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectSlideRow = Database['public']['Tables']['project_slides']['Row'];
export type ProjectVersionRow = Database['public']['Tables']['project_versions']['Row'];

export type { ProjectType, ProjectStatus, ProjectFormat, SlideStatus };
