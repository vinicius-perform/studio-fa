// src/types/domain/ai.ts
import { z } from 'zod';
import type {
  Database,
  GenerationOperationType,
  GenerationRequestStatus,
  GenerationOutputType,
  AIJobType,
  AIJobStatus,
  ApprovalStatus,
} from '@/types/database';

export const InputSnapshotSchema = z.object({
  brand_profile_id: z.string().uuid().optional(),
  brand_profile_version: z.number().int().optional(),
  reference_ids: z.array(z.string().uuid()).default([]),
  prompt: z.string(),
  model: z.string(),
  provider: z.string(),
  parameters: z.record(z.unknown()).default({}),
  assets_used: z.array(z.string().uuid()).default([]),
  created_at: z.string().datetime(),
});

export const CreateGenerationRequestSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  slide_id: z.string().uuid().optional(),
  provider: z.string().default('openai'),
  model: z.string(),
  operation_type: z.enum([
    'brand_analysis',
    'reference_analysis',
    'embedding',
    'image_generate',
    'image_edit',
    'variation',
    'background_generate',
    'other',
  ]),
  prompt: z.string().min(1),
  system_context: z.string().optional(),
  input_snapshot: InputSnapshotSchema,
  parameters: z.record(z.unknown()).default({}),
  idempotency_key: z.string().optional(),
});

export const CreateAIUsageEventSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  slide_id: z.string().uuid().optional(),
  generation_request_id: z.string().uuid().optional(),
  provider: z.string(),
  model: z.string(),
  operation_type: z.string(),
  input_text_tokens: z.number().int().optional(),
  input_image_tokens: z.number().int().optional(),
  output_text_tokens: z.number().int().optional(),
  output_image_tokens: z.number().int().optional(),
  total_tokens: z.number().int().optional(),
  estimated_cost_usd: z.number().nonnegative(),
  actual_cost_usd: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const CreateAIJobSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  slide_id: z.string().uuid().optional(),
  job_type: z.enum([
    'analyze_brand',
    'analyze_reference',
    'create_embedding',
    'generate_image',
    'edit_image',
    'generate_variation',
  ]),
  priority: z.number().int().default(0),
  payload: z.record(z.unknown()),
  idempotency_key: z.string().optional(),
});

export type InputSnapshot = z.infer<typeof InputSnapshotSchema>;
export type CreateGenerationRequestInput = z.infer<typeof CreateGenerationRequestSchema>;
export type CreateAIUsageEventInput = z.infer<typeof CreateAIUsageEventSchema>;
export type CreateAIJobInput = z.infer<typeof CreateAIJobSchema>;

export type GenerationRequestRow = Database['public']['Tables']['generation_requests']['Row'];
export type GenerationOutputRow = Database['public']['Tables']['generation_outputs']['Row'];
export type AIUsageEventRow = Database['public']['Tables']['ai_usage_events']['Row'];
export type AIJobRow = Database['public']['Tables']['ai_jobs']['Row'];
export type ApprovalRow = Database['public']['Tables']['approvals']['Row'];

export type {
  GenerationOperationType,
  GenerationRequestStatus,
  GenerationOutputType,
  AIJobType,
  AIJobStatus,
  ApprovalStatus,
};
