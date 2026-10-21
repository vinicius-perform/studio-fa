// src/app/api/clients/[id]/logos/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireClientAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { canWriteData } from '@/lib/auth/permissions';
import { StorageService } from '@/services/storage/storage.service';

const VALID_LOGO_TYPES = ['logo_primary', 'logo_secondary', 'logo_monochrome'] as const;
type LogoType = (typeof VALID_LOGO_TYPES)[number];

const LOGO_LABELS: Record<LogoType, string> = {
  logo_primary: 'Logo Principal',
  logo_secondary: 'Logo Secundário / Ícone',
  logo_monochrome: 'Logo Monocromático / Branco',
};

/**
 * POST /api/clients/[id]/logos
 * Faz upload ou substituição de um dos 3 slots oficiais de logotipo da marca.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const body = await req.json();
    const { assetType, base64, filename, mimeType } = body;

    if (!assetType || !VALID_LOGO_TYPES.includes(assetType as LogoType)) {
      return NextResponse.json(
        { error: { message: `assetType inválido. Deve ser um de: ${VALID_LOGO_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json(
        { error: { message: 'Conteúdo base64 do arquivo de imagem é obrigatório.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (!canWriteData(session.role)) {
      return NextResponse.json(
        { error: { message: 'Permissão insuficiente para alterar logos da marca.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const orgId = session.organizationId;
    const label = LOGO_LABELS[assetType as LogoType];
    const cleanFilename = filename || `${assetType}.png`;
    const resolvedMime = mimeType || 'image/png';

    // 1. Upload seguro para o Supabase Storage
    const uploadResult = await StorageService.uploadBase64({
      bucket: 'client-brand-assets',
      organizationId: orgId,
      clientId,
      folder: 'logos',
      originalFilename: cleanFilename,
      base64Data: base64,
      mimeType: resolvedMime,
    });

    // 2. Busca se já existe um logo desse tipo para remover o arquivo anterior se necessário
    const { data: existingLogo } = await (supabase as any)
      .from('client_assets')
      .select('id, storage_bucket, storage_path')
      .eq('client_id', clientId)
      .eq('asset_type', assetType)
      .maybeSingle();

    if (existingLogo?.storage_path) {
      try {
        await StorageService.deleteFile(
          existingLogo.storage_bucket || 'client-brand-assets',
          existingLogo.storage_path
        );
      } catch (e) {
        console.warn('[POST /api/clients/[id]/logos] Falha ao remover asset antigo do storage:', e);
      }
    }

    // 3. Atualiza ou insere o registro na tabela client_assets
    let assetRow: any;
    if (existingLogo) {
      const { data: updated, error: updateErr } = await (supabase as any)
        .from('client_assets')
        .update({
          label,
          storage_bucket: uploadResult.storageBucket,
          storage_path: uploadResult.storagePath,
          original_filename: cleanFilename,
          mime_type: uploadResult.mimeType,
          file_size_bytes: uploadResult.fileSizeBytes,
          uploaded_by: session.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLogo.id)
        .select('*')
        .single();

      if (updateErr) throw updateErr;
      assetRow = updated;
    } else {
      const { data: inserted, error: insertErr } = await (supabase as any)
        .from('client_assets')
        .insert({
          organization_id: orgId,
          client_id: clientId,
          asset_type: assetType,
          label,
          storage_bucket: uploadResult.storageBucket,
          storage_path: uploadResult.storagePath,
          original_filename: cleanFilename,
          mime_type: uploadResult.mimeType,
          file_size_bytes: uploadResult.fileSizeBytes,
          uploaded_by: session.userId,
        })
        .select('*')
        .single();

      if (insertErr) throw insertErr;
      assetRow = inserted;
    }

    // 4. Gera Signed URL
    const signedUrl = await StorageService.createSignedUrl(
      assetRow.storage_bucket || 'client-brand-assets',
      assetRow.storage_path,
      86400
    );

    return NextResponse.json({
      success: true,
      asset: {
        ...assetRow,
        signedUrl,
      },
    });
  } catch (err: any) {
    console.error('[POST /api/clients/[id]/logos] Erro:', err);
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(
      { error: { message: err?.message || 'Falha ao salvar logotipo do cliente.' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/logos
 * Remove um logotipo cadastrado do cliente.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const { searchParams } = new URL(req.url);
    const assetType = searchParams.get('assetType');
    const assetId = searchParams.get('assetId');

    if (!assetType && !assetId) {
      return NextResponse.json(
        { error: { message: 'assetType ou assetId deve ser informado para exclusão.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (!canWriteData(session.role)) {
      return NextResponse.json(
        { error: { message: 'Permissão insuficiente para remover logos da marca.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    let query = (supabase as any)
      .from('client_assets')
      .select('id, storage_bucket, storage_path')
      .eq('client_id', clientId);

    if (assetId) {
      query = query.eq('id', assetId);
    } else if (assetType) {
      query = query.eq('asset_type', assetType);
    }

    const { data: targetAsset, error: findErr } = await query.maybeSingle();

    if (findErr || !targetAsset) {
      return NextResponse.json({ error: { message: 'Logotipo não encontrado.' } }, { status: 404 });
    }

    if (targetAsset.storage_path) {
      try {
        await StorageService.deleteFile(
          targetAsset.storage_bucket || 'client-brand-assets',
          targetAsset.storage_path
        );
      } catch (delStorageErr) {
        console.warn('[DELETE /api/clients/[id]/logos] Erro ao deletar do storage:', delStorageErr);
      }
    }

    const { error: dbDeleteErr } = await (supabase as any)
      .from('client_assets')
      .delete()
      .eq('id', targetAsset.id);

    if (dbDeleteErr) throw dbDeleteErr;

    return NextResponse.json({
      success: true,
      deletedAssetId: targetAsset.id,
    });
  } catch (err: any) {
    console.error('[DELETE /api/clients/[id]/logos] Erro:', err);
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(
      { error: { message: err?.message || 'Falha ao remover logotipo do cliente.' } },
      { status: 500 }
    );
  }
}
