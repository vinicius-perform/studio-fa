// supabase/functions/storage-sign/index.ts
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, AppHttpError } from '../_shared/errors.ts';
import { requireAuth, requireOrganizationMember } from '../_shared/auth.ts';
import { validateStorageSignRequest } from '../_shared/schemas.ts';
import { logEvent } from '../_shared/logger.ts';
import { getSupabaseAdminClient } from '../_shared/client.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return errorResponse(new AppHttpError('METHOD_NOT_ALLOWED', 405, 'Método não permitido.'));
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { user, supabase } = await requireAuth(req);
    const body = await req.json();
    const params = validateStorageSignRequest(body);

    // Validate organization membership and role
    const { role } = await requireOrganizationMember(
      supabase,
      params.organization_id,
      user.id
    );

    // Role-specific upload permissions check
    if (params.operation === 'upload') {
      if (role === 'viewer') {
        throw new AppHttpError('FORBIDDEN', 403, 'Visualizadores não possuem permissão de upload.');
      }
      if (
        role === 'designer' &&
        (params.bucket === 'client-brand-assets' || params.bucket === 'exports')
      ) {
        throw new AppHttpError(
          'FORBIDDEN',
          403,
          'Designers não podem fazer upload direto em client-brand-assets ou exports.'
        );
      }
    }

    // Verify client belongs to organization
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', params.client_id)
      .eq('organization_id', params.organization_id)
      .single();

    if (clientErr || !client) {
      throw new AppHttpError('NOT_FOUND', 404, 'Cliente não encontrado nesta organização.');
    }

    // Standardized secure path: {organization_id}/{client_id}/{category}/{filename}
    const storagePath = `${params.organization_id}/${params.client_id}/${params.category}/${params.filename}`;

    const adminClient = getSupabaseAdminClient();
    let signedUrl = '';

    if (params.operation === 'upload') {
      const { data, error } = await adminClient.storage
        .from(params.bucket)
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        throw new Error(`Falha ao gerar URL assinada para upload: ${error?.message}`);
      }
      signedUrl = data.signedUrl;
    } else {
      const { data, error } = await adminClient.storage
        .from(params.bucket)
        .createSignedUrl(storagePath, params.expires_in ?? 3600);

      if (error || !data) {
        throw new Error(`Falha ao gerar URL assinada para download: ${error?.message}`);
      }
      signedUrl = data.signedUrl;
    }

    logEvent({
      requestId,
      userId: user.id,
      organizationId: params.organization_id,
      operation: `storage_sign_${params.operation}`,
      durationMs: Date.now() - startTime,
      result: 'success',
      metadata: {
        bucket: params.bucket,
        storagePath,
      },
    });

    return jsonResponse({
      signed_url: signedUrl,
      bucket: params.bucket,
      storage_path: storagePath,
      operation: params.operation,
      expires_in: params.expires_in ?? 3600,
    });
  } catch (err) {
    logEvent({
      requestId,
      operation: 'storage_sign',
      durationMs: Date.now() - startTime,
      result: 'error',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });

    return errorResponse(err);
  }
});
