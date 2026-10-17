// src/types/domain/asset.ts
import { z } from 'zod';
import type { Database, AssetType } from '@/types/database';

export const StorageBucketSchema = z.enum([
  'client-brand-assets',
  'brand-references',
  'client-inputs',
  'generated-assets',
  'exports',
]);

export const AllowedMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
] as const;

export const AssetTypeSchema = z.enum([
  'logo_primary',
  'logo_secondary',
  'logo_monochrome',
  'font',
  'brand_manual',
  'icon',
  'graphic_element',
  'reference_art',
  'client_photo',
  'base_image',
  'generated_image',
  'export',
  'other',
]);

export const CreateClientAssetSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  asset_type: AssetTypeSchema,
  label: z.string().optional(),
  storage_bucket: StorageBucketSchema,
  storage_path: z.string().min(5),
  original_filename: z.string().min(1),
  mime_type: z.string().min(1),
  file_size_bytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  has_alpha: z.boolean().optional(),
  checksum: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type StorageBucket = z.infer<typeof StorageBucketSchema>;
export type CreateClientAssetInput = z.infer<typeof CreateClientAssetSchema>;
export type ClientAssetRow = Database['public']['Tables']['client_assets']['Row'];
export type { AssetType };

/**
 * Builds standard storage path: {organization_id}/{client_id}/{category}/{uuid}.{ext}
 */
export function buildStoragePath(params: {
  organizationId: string;
  clientId: string;
  category: string;
  filename: string;
}): string {
  const ext = params.filename.includes('.') ? params.filename.split('.').pop() : 'bin';
  const fileId = crypto.randomUUID();
  const safeCategory = params.category.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `${params.organizationId}/${params.clientId}/${safeCategory}/${fileId}.${ext}`;
}
