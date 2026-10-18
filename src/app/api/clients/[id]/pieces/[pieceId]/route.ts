// src/app/api/clients/[id]/pieces/[pieceId]/route.ts
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
import { StorageService } from '@/services/storage/storage.service';

export async function GET(
  req: Request,
  { params }: { params: { id: string; pieceId: string } }
) {
  try {
    const { id: clientId, pieceId } = params;
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    await requireClientAccess(supabase, session, clientId);

    const { data: piece, error: pieceErr } = await (supabase as any)
      .from('client_pieces')
      .select('*')
      .eq('id', pieceId)
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .maybeSingle();

    if (pieceErr || !piece) {
      return NextResponse.json({ error: { message: 'Peça não encontrada.' } }, { status: 404 });
    }

    let signedUrl = null;
    if (piece.storage_path) {
      signedUrl = await StorageService.createSignedUrl(
        piece.storage_bucket || 'client-pieces',
        piece.storage_path,
        3600
      );
    }

    return NextResponse.json({
      piece: {
        ...piece,
        signedUrl,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; pieceId: string } }
) {
  try {
    const { id: clientId, pieceId } = params;
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para excluir peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const { data: piece, error: pieceErr } = await (supabase as any)
      .from('client_pieces')
      .select('id, storage_bucket, storage_path')
      .eq('id', pieceId)
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .maybeSingle();

    if (pieceErr || !piece) {
      return NextResponse.json({ error: { message: 'Peça não encontrada.' } }, { status: 404 });
    }

    // 1. Remove arquivo do Storage se existir
    if (piece.storage_path) {
      await StorageService.deleteFile(piece.storage_bucket || 'client-pieces', piece.storage_path);
    }

    // 2. Remove registro do banco
    const { error: deleteErr } = await (supabase as any)
      .from('client_pieces')
      .delete()
      .eq('id', pieceId);

    if (deleteErr) {
      return NextResponse.json({ error: { message: deleteErr.message } }, { status: 500 });
    }

    // 3. Atualiza status de memória visual caso a peça fizesse parte do DNA ou fosse completed
    try {
      const { data: remainingPieces } = await (supabase as any)
        .from('client_pieces')
        .select('id, analysis_status')
        .eq('client_id', clientId);

      const remainingList = remainingPieces || [];
      const remainingCompleted = remainingList.filter((p: any) => p.analysis_status === 'completed');

      let newStatus = 'needs_refresh';
      if (remainingList.length === 0) {
        newStatus = 'awaiting_references';
      } else if (remainingCompleted.length === 0) {
        newStatus = 'awaiting_analysis';
      }

      await (supabase as any)
        .from('clients')
        .update({
          visual_memory_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      // Marca também a versão ativa como needs_refresh em brand_dna_versions se existir
      await (supabase as any)
        .from('brand_dna_versions')
        .update({ status: 'needs_refresh' })
        .eq('client_id', clientId)
        .eq('status', 'ready');
    } catch (statusErr: any) {
      // Falha silenciosa para não bloquear deleção
      console.warn('[DELETE piece] Falha ao atualizar visual_memory_status:', statusErr?.message);
    }

    return NextResponse.json({ success: true, message: 'Peça excluída com sucesso.' });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
