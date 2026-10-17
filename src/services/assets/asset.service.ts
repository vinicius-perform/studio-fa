// src/services/assets/asset.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  CreateClientAssetSchema,
  AllowedMimeTypes,
  buildStoragePath,
  type CreateClientAssetInput,
  type ClientAssetRow,
  type StorageBucket,
} from '@/types/domain/asset';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class AssetService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  validateFile(file: { name: string; type: string; size: number }): { valid: boolean; error?: string } {
    if (file.size > 52428800) {
      // 50MB
      return { valid: false, error: 'Arquivo excede o limite máximo permitido de 50MB.' };
    }

    if (!AllowedMimeTypes.includes(file.type as (typeof AllowedMimeTypes)[number])) {
      return { valid: false, error: `Tipo de arquivo não suportado: ${file.type}` };
    }

    return { valid: true };
  }

  async listByClient(clientId: string, organizationId: string): Promise<ClientAssetRow[]> {
    const { data, error } = await this.supabase
      .from('client_assets')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      Logger.error({ operation: 'listAssets', organizationId, result: 'error' }, error);
      throw error;
    }

    return data || [];
  }

  async getById(id: string, organizationId: string): Promise<ClientAssetRow> {
    const { data, error } = await this.supabase
      .from('client_assets')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Asset', id);
    }

    return data;
  }

  async recordAssetMetadata(input: CreateClientAssetInput, userId: string): Promise<ClientAssetRow> {
    const validated = CreateClientAssetSchema.parse(input);

    const { data, error } = await this.supabase
      .from('client_assets')
      .insert({
        organization_id: validated.organization_id,
        client_id: validated.client_id,
        asset_type: validated.asset_type,
        label: validated.label ?? null,
        storage_bucket: validated.storage_bucket,
        storage_path: validated.storage_path,
        original_filename: validated.original_filename,
        mime_type: validated.mime_type,
        file_size_bytes: validated.file_size_bytes,
        width: validated.width ?? null,
        height: validated.height ?? null,
        has_alpha: validated.has_alpha ?? null,
        checksum: validated.checksum ?? null,
        metadata: validated.metadata,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error || !data) {
      Logger.error({ operation: 'recordAssetMetadata', result: 'error' }, error);
      throw new ValidationError(`Falha ao registrar asset: ${error?.message}`);
    }

    Logger.info({
      operation: 'recordAssetMetadata',
      organizationId: validated.organization_id,
      userId,
      result: 'success',
      metadata: { assetId: data.id, path: data.storage_path },
    });

    return data;
  }

  generatePath(params: {
    organizationId: string;
    clientId: string;
    category: string;
    filename: string;
  }): string {
    return buildStoragePath(params);
  }

  async createSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresIn = 3600
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data) {
      throw new ValidationError(`Erro ao gerar URL assinada: ${error?.message}`);
    }

    return data.signedUrl;
  }
}
