// src/app/api/clients/[id]/references/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireClientAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { isDevStoreAllowed } from '@/config/env';

import { StorageService } from '@/services/storage/storage.service';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;

    if (isDevStoreAllowed()) {
      const devRefs = devStore.listBrandReferences(clientId);
      return NextResponse.json({ references: devRefs });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // Valida que o usuário tem acesso a este cliente
    await requireClientAccess(supabase, session, clientId);

    // 1. Busca peças de client_pieces (padrão oficial de referências)
    const { data: pieces, error: piecesErr } = await supabase
      .from('client_pieces')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false });

    if (piecesErr) {
      console.warn('Erro ao buscar client_pieces:', piecesErr);
    }

    // 2. Busca referências legadas de brand_references
    const { data: legacyRefs, error: legacyErr } = await supabase
      .from('brand_references')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false });

    if (legacyErr) {
      console.warn('Erro ao buscar brand_references:', legacyErr);
    }

    const mappedPieces = await Promise.all(
      (pieces || []).map(async (piece: any) => {
        let imageUrl = '';
        try {
          const signed = await StorageService.createSignedUrl(
            piece.storage_bucket || 'client-pieces',
            piece.storage_path,
            7200
          );
          if (signed) imageUrl = signed;
        } catch (e: any) {
          console.warn(`[references] Falha ao assinar URL da peça ${piece.id}:`, e?.message);
        }

        const tags: string[] = [];
        if (piece.format_type) tags.push(piece.format_type);
        if (piece.piece_type) tags.push(piece.piece_type);

        return {
          id: piece.id,
          organization_id: piece.organization_id,
          client_id: piece.client_id,
          title: piece.title || piece.original_filename || 'Peça de Referência',
          description: piece.notes || piece.original_filename || null,
          reference_type: piece.piece_type || piece.format_type || 'client_piece',
          tags,
          image_url: imageUrl,
          ai_description: (piece.analysis_json as any)?.description || null,
          visual_features: piece.analysis_json || {},
          created_at: piece.created_at,
        };
      })
    );

    const mappedLegacy = (legacyRefs || []).map((ref: any) => ({
      id: ref.id,
      organization_id: ref.organization_id,
      client_id: ref.client_id,
      title: ref.title,
      description: ref.description || null,
      reference_type: ref.reference_type || 'instagram_post',
      tags: ref.tags || [],
      image_url: ref.image_url,
      ai_description: ref.ai_description || null,
      visual_features: ref.visual_features || {},
      created_at: ref.created_at,
    }));

    const pieceIds = new Set(mappedPieces.map((p) => p.id));
    const combined = [...mappedPieces, ...mappedLegacy.filter((lr) => !pieceIds.has(lr.id))];

    return NextResponse.json({ references: combined });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const body = await req.json();
    const { title, referenceType, tags, imageUrl, description } = body;

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: { message: 'Título e imagem da peça são obrigatórios.' } },
        { status: 400 }
      );
    }

    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const devRef = devStore.addBrandReference({
        organization_id: orgId,
        client_id: clientId,
        title: title.trim(),
        description: description?.trim() || null,
        reference_type: referenceType || 'instagram_post',
        tags: Array.isArray(tags) ? tags : [],
        image_url: imageUrl,
      });
      return NextResponse.json({ reference: devRef }, { status: 201 });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para adicionar peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const { data: newRef, error: insertErr } = await (supabase.from('brand_references') as any)
      .insert({
        organization_id: session.organizationId,
        client_id: clientId,
        title: title.trim(),
        description: description?.trim() || null,
        reference_type: referenceType || 'instagram_post',
        tags: Array.isArray(tags) ? tags : [],
        image_url: imageUrl,
        is_approved: true,
        visual_features: {},
        ai_description: null,
      })
      .select('*')
      .single();

    if (insertErr) {
      throw insertErr;
    }

    return NextResponse.json({ reference: newRef }, { status: 201 });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const { searchParams } = new URL(req.url);
    const referenceId = searchParams.get('referenceId');

    if (!referenceId) {
      return NextResponse.json({ error: { message: 'referenceId é obrigatório' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      devStore.deleteBrandReference(referenceId);
      return NextResponse.json({ success: true });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para excluir peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    // Exclui de client_pieces se existir
    const { error: delPieceErr } = await supabase
      .from('client_pieces')
      .delete()
      .eq('id', referenceId)
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId);

    // Exclui de brand_references se existir
    const { error: delLegacyErr } = await supabase
      .from('brand_references')
      .delete()
      .eq('id', referenceId)
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId);

    if (delPieceErr && delLegacyErr) {
      console.warn('Erro ao deletar referência:', delPieceErr, delLegacyErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
