// src/services/ai/ai.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  CreateGenerationRequestSchema,
  CreateAIUsageEventSchema,
  CreateAIJobSchema,
  type CreateGenerationRequestInput,
  type CreateAIUsageEventInput,
  type CreateAIJobInput,
  type GenerationRequestRow,
  type AIUsageEventRow,
  type AIJobRow,
} from '@/types/domain/ai';
import { ValidationError, ConflictError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class AIService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async createGenerationRequest(
    input: CreateGenerationRequestInput,
    userId: string
  ): Promise<GenerationRequestRow> {
    const validated = CreateGenerationRequestSchema.parse(input);

    // Idempotency check
    if (validated.idempotency_key) {
      const { data: existing } = await this.supabase
        .from('generation_requests')
        .select('*')
        .eq('idempotency_key', validated.idempotency_key)
        .eq('organization_id', validated.organization_id)
        .maybeSingle();

      if (existing) {
        Logger.info({
          operation: 'idempotent_request_hit',
          organizationId: validated.organization_id,
          result: 'success',
          metadata: { idempotencyKey: validated.idempotency_key, requestId: existing.id },
        });
        return existing;
      }
    }

    const { data, error } = await this.supabase
      .from('generation_requests')
      .insert({
        organization_id: validated.organization_id,
        client_id: validated.client_id,
        project_id: validated.project_id ?? null,
        slide_id: validated.slide_id ?? null,
        requested_by: userId,
        provider: validated.provider,
        model: validated.model,
        operation_type: validated.operation_type,
        status: 'queued',
        prompt: validated.prompt,
        system_context: validated.system_context ?? null,
        input_snapshot: validated.input_snapshot,
        parameters: validated.parameters,
        idempotency_key: validated.idempotency_key ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'createGenerationRequest', result: 'error' }, error);
      throw new ValidationError(`Erro ao criar solicitação de IA: ${error?.message}`);
    }

    return data;
  }

  async recordUsageEvent(input: CreateAIUsageEventInput): Promise<AIUsageEventRow> {
    const validated = CreateAIUsageEventSchema.parse(input);

    const { data, error } = await this.supabase
      .from('ai_usage_events')
      .insert({
        organization_id: validated.organization_id,
        client_id: validated.client_id ?? null,
        user_id: validated.user_id ?? null,
        project_id: validated.project_id ?? null,
        slide_id: validated.slide_id ?? null,
        generation_request_id: validated.generation_request_id ?? null,
        provider: validated.provider,
        model: validated.model,
        operation_type: validated.operation_type,
        input_text_tokens: validated.input_text_tokens ?? null,
        input_image_tokens: validated.input_image_tokens ?? null,
        output_text_tokens: validated.output_text_tokens ?? null,
        output_image_tokens: validated.output_image_tokens ?? null,
        total_tokens: validated.total_tokens ?? null,
        estimated_cost_usd: validated.estimated_cost_usd,
        actual_cost_usd: validated.actual_cost_usd ?? null,
        metadata: validated.metadata,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'recordUsageEvent', result: 'error' }, error);
      throw new ValidationError(`Erro ao registrar evento de uso de IA: ${error?.message}`);
    }

    return data;
  }

  async queueJob(input: CreateAIJobInput, userId: string): Promise<AIJobRow> {
    const validated = CreateAIJobSchema.parse(input);

    if (validated.idempotency_key) {
      const { data: existing } = await this.supabase
        .from('ai_jobs')
        .select('*')
        .eq('idempotency_key', validated.idempotency_key)
        .eq('organization_id', validated.organization_id)
        .maybeSingle();

      if (existing) {
        return existing;
      }
    }

    const { data, error } = await this.supabase
      .from('ai_jobs')
      .insert({
        organization_id: validated.organization_id,
        client_id: validated.client_id ?? null,
        project_id: validated.project_id ?? null,
        slide_id: validated.slide_id ?? null,
        job_type: validated.job_type,
        status: 'queued',
        priority: validated.priority,
        payload: validated.payload,
        requested_by: userId,
        idempotency_key: validated.idempotency_key ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'queueJob', result: 'error' }, error);
      throw new ValidationError(`Erro ao enfileirar job de IA: ${error?.message}`);
    }

    return data;
  }
}
