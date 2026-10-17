// supabase/functions/_shared/schemas.ts
import { AppHttpError } from './errors.ts';

export interface StorageSignRequest {
  organization_id: string;
  client_id: string;
  bucket: 'client-brand-assets' | 'brand-references' | 'client-inputs' | 'generated-assets' | 'exports';
  category: string;
  filename: string;
  operation: 'upload' | 'download';
  expires_in?: number;
}

export function validateStorageSignRequest(body: unknown): StorageSignRequest {
  if (!body || typeof body !== 'object') {
    throw new AppHttpError('VALIDATION_ERROR', 400, 'Payload inválido.');
  }

  const b = body as Record<string, unknown>;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof b.organization_id !== 'string' || !uuidRegex.test(b.organization_id)) {
    throw new AppHttpError('VALIDATION_ERROR', 400, 'organization_id inválido.');
  }

  if (typeof b.client_id !== 'string' || !uuidRegex.test(b.client_id)) {
    throw new AppHttpError('VALIDATION_ERROR', 400, 'client_id inválido.');
  }

  const validBuckets = [
    'client-brand-assets',
    'brand-references',
    'client-inputs',
    'generated-assets',
    'exports',
  ];
  if (typeof b.bucket !== 'string' || !validBuckets.includes(b.bucket)) {
    throw new AppHttpError('VALIDATION_ERROR', 400, `Bucket inválido: ${b.bucket}`);
  }

  if (typeof b.category !== 'string' || !/^[a-z0-9_-]+$/i.test(b.category)) {
    throw new AppHttpError('VALIDATION_ERROR', 400, 'category inválida.');
  }

  if (typeof b.filename !== 'string' || b.filename.includes('/') || b.filename.includes('..')) {
    throw new AppHttpError('VALIDATION_ERROR', 400, 'Nome de arquivo inválido.');
  }

  if (b.operation !== 'upload' && b.operation !== 'download') {
    throw new AppHttpError('VALIDATION_ERROR', 400, 'Operação deve ser upload ou download.');
  }

  return {
    organization_id: b.organization_id,
    client_id: b.client_id,
    bucket: b.bucket as StorageSignRequest['bucket'],
    category: b.category,
    filename: b.filename,
    operation: b.operation,
    expires_in: typeof b.expires_in === 'number' ? b.expires_in : 3600,
  };
}
