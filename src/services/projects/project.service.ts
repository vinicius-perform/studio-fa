// src/services/projects/project.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  CreateProjectSchema,
  CreateSlideSchema,
  CreateProjectVersionSchema,
  type CreateProjectInput,
  type CreateSlideInput,
  type CreateProjectVersionInput,
  type ProjectRow,
  type ProjectSlideRow,
  type ProjectVersionRow,
} from '@/types/domain/project';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class ProjectService {
  constructor(private readonly supabase: SupabaseClient<any, any, any>) {}

  async list(organizationId: string, options?: { clientId?: string }): Promise<ProjectRow[]> {
    let query = this.supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (options?.clientId) {
      query = query.eq('client_id', options.clientId);
    }

    const { data, error } = await query;

    if (error) {
      Logger.error({ operation: 'listProjects', organizationId, result: 'error' }, error);
      throw error;
    }

    return data || [];
  }

  async getById(id: string, organizationId: string): Promise<
    ProjectRow & { slides: ProjectSlideRow[] }
  > {
    const { data: project, error: projErr } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (projErr || !project) {
      throw new NotFoundError('Projeto', id);
    }

    const { data: slides, error: slidesErr } = await this.supabase
      .from('project_slides')
      .select('*')
      .eq('project_id', id)
      .order('slide_index', { ascending: true });

    if (slidesErr) {
      throw slidesErr;
    }

    return {
      ...project,
      slides: slides || [],
    };
  }

  async create(input: CreateProjectInput, userId: string): Promise<ProjectRow> {
    const validated = CreateProjectSchema.parse(input);

    const { data, error } = await this.supabase
      .from('projects')
      .insert({
        organization_id: validated.organization_id,
        client_id: validated.client_id,
        title: validated.title,
        project_type: validated.project_type,
        status: validated.status,
        format: validated.format,
        width: validated.width ?? null,
        height: validated.height ?? null,
        generation_mode: validated.generation_mode ?? null,
        brief: validated.brief ?? null,
        metadata: validated.metadata,
        created_by: userId,
        assigned_to: validated.assigned_to ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'createProject', result: 'error' }, error);
      throw new ValidationError(`Erro ao criar projeto: ${error?.message}`);
    }

    // Initialize slide 0 for single_post or carousel
    await this.supabase.from('project_slides').insert({
      organization_id: validated.organization_id,
      project_id: data.id,
      slide_index: 0,
      status: 'draft',
      metadata: {},
    });

    Logger.info({
      operation: 'createProject',
      organizationId: validated.organization_id,
      userId,
      result: 'success',
      metadata: { projectId: data.id },
    });

    return data;
  }

  async addSlide(input: CreateSlideInput): Promise<ProjectSlideRow> {
    const validated = CreateSlideSchema.parse(input);

    const { data, error } = await this.supabase
      .from('project_slides')
      .insert({
        organization_id: validated.organization_id,
        project_id: validated.project_id,
        slide_index: validated.slide_index,
        slide_type: validated.slide_type ?? null,
        title: validated.title ?? null,
        subtitle: validated.subtitle ?? null,
        body: validated.body ?? null,
        cta: validated.cta ?? null,
        instructions: validated.instructions ?? null,
        base_asset_id: validated.base_asset_id ?? null,
        status: validated.status,
        metadata: validated.metadata,
      })
      .select()
      .single();

    if (error || !data) {
      throw new ValidationError(`Erro ao adicionar slide: ${error?.message}`);
    }

    return data;
  }

  async createVersion(input: CreateProjectVersionInput, userId: string): Promise<ProjectVersionRow> {
    const validated = CreateProjectVersionSchema.parse(input);

    const { data, error } = await this.supabase
      .from('project_versions')
      .insert({
        organization_id: validated.organization_id,
        project_id: validated.project_id,
        version_number: validated.version_number,
        snapshot: validated.snapshot,
        label: validated.label ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error || !data) {
      throw new ValidationError(`Erro ao criar snapshot de versão: ${error?.message}`);
    }

    return data;
  }
}
