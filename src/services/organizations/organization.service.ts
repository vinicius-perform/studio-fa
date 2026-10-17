// src/services/organizations/organization.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, AppRole } from '@/types/database';
import {
  CreateOrganizationSchema,
  AddOrganizationMemberSchema,
  type CreateOrganizationInput,
  type AddOrganizationMemberInput,
  type OrganizationRow,
  type OrganizationMemberRow,
} from '@/types/domain/organization';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class OrganizationService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getById(id: string): Promise<OrganizationRow> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Organização', id);
    }

    return data;
  }

  async getBySlug(slug: string): Promise<OrganizationRow> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      throw new NotFoundError('Organização', slug);
    }

    return data;
  }

  async listUserOrganizations(userId: string): Promise<
    (OrganizationMemberRow & { organization: OrganizationRow })[]
  > {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select('*, organization:organizations(*)')
      .eq('user_id', userId);

    if (error) {
      Logger.error({ operation: 'listUserOrganizations', userId, result: 'error' }, error);
      throw error;
    }

    return (data || []) as unknown as (OrganizationMemberRow & { organization: OrganizationRow })[];
  }

  async create(input: CreateOrganizationInput, creatorUserId: string): Promise<OrganizationRow> {
    const validated = CreateOrganizationSchema.parse(input);

    const { data: org, error: orgErr } = await this.supabase
      .from('organizations')
      .insert({
        name: validated.name,
        slug: validated.slug,
        logo_path: validated.logo_path ?? null,
        settings: validated.settings,
      })
      .select()
      .single();

    if (orgErr || !org) {
      Logger.error({ operation: 'createOrganization', result: 'error' }, orgErr);
      throw new ValidationError(`Erro ao criar organização: ${orgErr?.message}`);
    }

    // Add creator as owner
    const { error: memberErr } = await this.supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: creatorUserId,
        role: 'owner',
      });

    if (memberErr) {
      Logger.error({ operation: 'addInitialOwner', result: 'error' }, memberErr);
      throw memberErr;
    }

    Logger.info({
      operation: 'createOrganization',
      organizationId: org.id,
      userId: creatorUserId,
      result: 'success',
    });

    return org;
  }

  async addMember(input: AddOrganizationMemberInput): Promise<OrganizationMemberRow> {
    const validated = AddOrganizationMemberSchema.parse(input);

    const { data, error } = await this.supabase
      .from('organization_members')
      .insert({
        organization_id: validated.organization_id,
        user_id: validated.user_id,
        role: validated.role,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'addMember', result: 'error' }, error);
      throw new ValidationError(`Erro ao adicionar membro: ${error?.message}`);
    }

    return data;
  }

  async checkRole(
    organizationId: string,
    userId: string,
    allowedRoles: AppRole[]
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('has_organization_role', {
      p_org_id: organizationId,
      p_roles: allowedRoles,
      p_user_id: userId,
    });

    if (error) {
      Logger.error({ operation: 'checkRole', result: 'error' }, error);
      return false;
    }

    return Boolean(data);
  }
}
