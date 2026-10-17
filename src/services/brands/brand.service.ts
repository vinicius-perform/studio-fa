// src/services/brands/brand.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  BrandProfileSchema,
  CreateBrandReferenceSchema,
  type BrandProfile,
  type BrandProfileRow,
  type BrandReferenceRow,
  type CreateBrandReferenceInput,
} from '@/types/domain/brand';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class BrandService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getActiveProfile(clientId: string, organizationId: string): Promise<BrandProfileRow | null> {
    const { data, error } = await this.supabase
      .from('brand_profiles')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', organizationId)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) {
      Logger.error({ operation: 'getActiveProfile', organizationId, result: 'error' }, error);
      throw error;
    }

    return data;
  }

  async listVersions(clientId: string, organizationId: string): Promise<BrandProfileRow[]> {
    const { data, error } = await this.supabase
      .from('brand_profiles')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', organizationId)
      .order('version', { ascending: false });

    if (error) {
      Logger.error({ operation: 'listVersions', organizationId, result: 'error' }, error);
      throw error;
    }

    return data || [];
  }

  async createVersion(params: {
    organizationId: string;
    clientId: string;
    profile: BrandProfile;
    source?: 'ai' | 'manual' | 'hybrid';
    rawAnalysis?: Record<string, unknown>;
    confidenceScore?: number;
    userId: string;
  }): Promise<BrandProfileRow> {
    const validated = BrandProfileSchema.parse(params.profile);

    // Get current max version
    const { data: latest } = await this.supabase
      .from('brand_profiles')
      .select('version')
      .eq('client_id', params.clientId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version ?? 0) + 1;

    const { data, error } = await this.supabase
      .from('brand_profiles')
      .insert({
        organization_id: params.organizationId,
        client_id: params.clientId,
        version: nextVersion,
        status: 'draft',
        source: params.source ?? 'ai',
        summary: validated.summary,
        colors: validated.colors,
        typography: validated.typography,
        composition: validated.composition,
        photography: validated.photography,
        logo_usage: validated.logoUsage,
        graphical_elements: validated.graphicalElements,
        visual_style: validated.visualStyle,
        content_style: validated.contentStyle,
        spacing_rules: validated.spacingRules ?? [],
        dos: validated.dos,
        donts: validated.donts,
        raw_analysis: params.rawAnalysis ?? {},
        confidence_score: params.confidenceScore ?? null,
        created_by: params.userId,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'createBrandProfileVersion', result: 'error' }, error);
      throw new ValidationError(`Falha ao registrar versão do Brand Profile: ${error?.message}`);
    }

    Logger.info({
      operation: 'createBrandProfileVersion',
      organizationId: params.organizationId,
      userId: params.userId,
      result: 'success',
      metadata: { profileId: data.id, version: nextVersion },
    });

    return data;
  }

  /**
   * Executes atomic approval transaction via RPC
   */
  async approveProfile(profileId: string): Promise<{
    success: boolean;
    profile_id: string;
    client_id: string;
    version: number;
    status: string;
  }> {
    const { data, error } = await this.supabase.rpc('approve_brand_profile', {
      p_profile_id: profileId,
    });

    if (error) {
      Logger.error({ operation: 'approveProfile', result: 'error', metadata: { profileId } }, error);
      throw new ValidationError(`Erro na aprovação atômica: ${error.message}`);
    }

    Logger.info({
      operation: 'approveBrandProfile',
      result: 'success',
      metadata: { profileId, outcome: data },
    });

    return data as {
      success: boolean;
      profile_id: string;
      client_id: string;
      version: number;
      status: string;
    };
  }

  async listReferences(clientId: string, organizationId: string): Promise<BrandReferenceRow[]> {
    const { data, error } = await this.supabase
      .from('brand_references')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async addReference(input: CreateBrandReferenceInput, userId: string): Promise<BrandReferenceRow> {
    const validated = CreateBrandReferenceSchema.parse(input);

    const { data, error } = await this.supabase
      .from('brand_references')
      .insert({
        organization_id: validated.organization_id,
        client_id: validated.client_id,
        asset_id: validated.asset_id ?? null,
        title: validated.title ?? null,
        description: validated.description ?? null,
        reference_type: validated.reference_type,
        tags: validated.tags,
        ai_description: validated.ai_description ?? null,
        visual_features: validated.visual_features,
        quality_score: validated.quality_score ?? null,
        is_approved: validated.is_approved,
        created_by: userId,
      })
      .select()
      .single();

    if (error || !data) {
      throw new ValidationError(`Erro ao salvar referência: ${error?.message}`);
    }

    return data;
  }

  async matchReferences(params: {
    organizationId: string;
    clientId: string;
    queryEmbedding: string;
    matchThreshold?: number;
    matchCount?: number;
  }) {
    const { data, error } = await this.supabase.rpc('match_brand_references', {
      p_organization_id: params.organizationId,
      p_client_id: params.clientId,
      query_embedding: params.queryEmbedding,
      match_threshold: params.matchThreshold ?? 0.5,
      match_count: params.matchCount ?? 10,
    });

    if (error) {
      Logger.error({ operation: 'matchReferences', result: 'error' }, error);
      throw error;
    }

    return data || [];
  }
}
