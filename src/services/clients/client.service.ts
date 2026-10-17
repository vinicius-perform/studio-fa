// src/services/clients/client.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  CreateClientSchema,
  UpdateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
  type ClientRow,
} from '@/types/domain/client';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class ClientService {
  constructor(private readonly supabase: SupabaseClient<any, any, any>) {}

  async list(organizationId: string, options?: { includeArchived?: boolean }): Promise<ClientRow[]> {
    let query = this.supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (!options?.includeArchived) {
      query = query.is('archived_at', null).neq('status', 'archived');
    }

    const { data, error } = await query;

    if (error) {
      Logger.error({ operation: 'listClients', organizationId, result: 'error' }, error);
      throw error;
    }

    return data || [];
  }

  async getById(id: string, organizationId: string): Promise<ClientRow> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Cliente', id);
    }

    return data;
  }

  async getBySlug(slug: string, organizationId: string): Promise<ClientRow> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('slug', slug)
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Cliente', slug);
    }

    return data;
  }

  async create(input: CreateClientInput, creatorUserId?: string | null): Promise<ClientRow> {
    const validated = CreateClientSchema.parse(input);

    const { data, error } = await this.supabase
      .from('clients')
      .insert({
        organization_id: validated.organization_id,
        name: validated.name,
        slug: validated.slug,
        legal_name: validated.legal_name ?? null,
        niche: validated.niche ?? null,
        instagram_handle: validated.instagram_handle ?? null,
        website: validated.website || null,
        city: validated.city ?? null,
        state: validated.state ?? null,
        country: validated.country,
        notes: validated.notes ?? null,
        status: validated.status,
        brand_status: validated.brand_status,
        created_by: creatorUserId || null,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'createClient', result: 'error' }, error);
      throw new ValidationError(`Erro ao criar cliente: ${error?.message}`);
    }

    Logger.info({
      operation: 'createClient',
      organizationId: validated.organization_id,
      userId: creatorUserId || 'system',
      result: 'success',
      metadata: { clientId: data.id, slug: data.slug },
    });

    return data;
  }

  async update(id: string, organizationId: string, input: UpdateClientInput): Promise<ClientRow> {
    const validated = UpdateClientSchema.parse(input);

    const { data, error } = await this.supabase
      .from('clients')
      .update({
        ...validated,
        website: validated.website || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error || !data) {
      throw new ValidationError(`Erro ao atualizar cliente: ${error?.message}`);
    }

    return data;
  }

  async archive(id: string, organizationId: string): Promise<ClientRow> {
    const { data, error } = await this.supabase
      .from('clients')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error || !data) {
      throw new ValidationError(`Erro ao arquivar cliente: ${error?.message}`);
    }

    Logger.info({
      operation: 'archiveClient',
      organizationId,
      result: 'success',
      metadata: { clientId: id },
    });

    return data;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      await this.supabase.from('brand_references').delete().eq('client_id', id);
      await this.supabase.from('brand_profiles').delete().eq('client_id', id);
      await this.supabase.from('client_assets').delete().eq('client_id', id);
    } catch (e) {
      // Ignore child cleanup error if cascade is in place
    }

    const { error } = await this.supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      Logger.error({ operation: 'deleteClient', organizationId, result: 'error' }, error);
      throw error;
    }

    Logger.info({
      operation: 'deleteClient',
      organizationId,
      result: 'success',
      metadata: { clientId: id },
    });

    return true;
  }
}
