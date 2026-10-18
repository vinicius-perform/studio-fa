// src/app/api/clients/[id]/analyze/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getServiceRoleClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireClientAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { formatError } from '@/lib/errors';
import { VisualAnalyzerService } from '@/services/ai/visual-analyzer.service';
import { BrandDNAService } from '@/services/ai/brand-dna.service';
import { Logger } from '@/lib/logger';

/**
 * Utilitário de pool de concorrência controlada para não estourar rate limit da OpenAI.
 */
async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  iteratorFn: (item: T) => Promise<R>
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (concurrency <= items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para executar análise visual.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const body = await req.json().catch(() => ({}));
    const { pieceIds, forceReanalyze } = body;

    // Busca cliente
    const { data: client, error: clientErr } = await (supabase as any)
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: { message: 'Cliente não encontrado.' } }, { status: 404 });
    }

    // Busca brand_profile para enriquecer o contexto se disponível
    const { data: profile } = await (supabase as any)
      .from('brand_profiles')
      .select('*')
      .eq('client_id', clientId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Query das peças a analisar
    let piecesQuery = (supabase as any)
      .from('client_pieces')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId);

    if (Array.isArray(pieceIds) && pieceIds.length > 0) {
      piecesQuery = piecesQuery.in('id', pieceIds);
    } else if (!forceReanalyze) {
      // Se não forçar, analisa peças pending, failed, queued e recovering de crash (analyzing)
      piecesQuery = piecesQuery.in('analysis_status', ['pending', 'failed', 'queued', 'analyzing']);
    }

    const { data: targetPieces, error: queryErr } = await piecesQuery;

    if (queryErr) {
      return NextResponse.json({ error: { message: queryErr.message } }, { status: 500 });
    }

    const pieces = (targetPieces || []) as any[];

    if (pieces.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma peça pendente para análise visual.',
        analyzedCount: 0,
        successCount: 0,
        failedCount: 0,
      });
    }

    // Atualiza status do cliente para analyzing
    await (supabase as any)
      .from('clients')
      .update({
        visual_memory_status: 'analyzing',
        brand_status: 'analyzing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    const serviceClient = getServiceRoleClient();
    const results: Array<{ pieceId: string; status: 'completed' | 'failed'; error?: string }> = [];

    // Executa análise com pool de no máximo 2 peças simultâneas
    await asyncPool(2, pieces, async (piece) => {
      // Marca como analyzing
      await (serviceClient as any)
        .from('client_pieces')
        .update({
          analysis_status: 'analyzing',
          analysis_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', piece.id);

      try {
        const analysisResult = await VisualAnalyzerService.analyzePiece({
          organizationId: session.organizationId,
          clientId,
          pieceId: piece.id,
          filename: piece.original_filename,
          storageBucket: piece.storage_bucket,
          storagePath: piece.storage_path,
          mimeType: piece.mime_type,
          width: piece.width,
          height: piece.height,
          aspectRatio: piece.aspect_ratio,
          formatType: piece.format_type,
          pieceType: piece.piece_type,
          clientInfo: {
            name: client.name,
            niche: client.niche,
            manualGuidelines: client.manual_guidelines,
          },
        });

        // Persiste resultado de sucesso
        await (serviceClient as any)
          .from('client_pieces')
          .update({
            analysis_status: 'completed',
            analysis_json: analysisResult.analysis as any,
            analysis_model: analysisResult.model,
            analysis_prompt_version: analysisResult.promptVersion,
            quality_score: analysisResult.analysis.qualityScore,
            analysis_error: null,
            analyzed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', piece.id);

        results.push({ pieceId: piece.id, status: 'completed' });
      } catch (err: any) {
        Logger.error({ operation: 'piece_analysis_failed', result: 'error', metadata: { pieceId: piece.id } }, err);

        // NUNCA forja sucesso! Grava o erro real
        await (serviceClient as any)
          .from('client_pieces')
          .update({
            analysis_status: 'failed',
            analysis_error: err?.message || 'Falha desconhecida na análise visual com IA.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', piece.id);

        results.push({ pieceId: piece.id, status: 'failed', error: err?.message });
      }
    });

    // 2. Consolidação do Brand DNA se houver peças concluídas com sucesso
    const { data: allCompletedPieces } = await (serviceClient as any)
      .from('client_pieces')
      .select('*')
      .eq('client_id', clientId)
      .eq('analysis_status', 'completed');

    let consolidatedDNA = null;
    const completedList = (allCompletedPieces || []) as any[];

    if (completedList.length > 0 || client.manual_guidelines) {
      try {
        consolidatedDNA = await BrandDNAService.consolidateDNA({
          organizationId: session.organizationId,
          clientId,
          clientName: client.name,
          clientNiche: client.niche,
          manualGuidelines: client.manual_guidelines,
          brandIdentity: {
            primaryColor: profile?.colors?.primary?.[0],
            secondaryColor: profile?.colors?.secondary?.[0],
            accentColor: profile?.colors?.accent?.[0],
            primaryFont: profile?.typography?.primaryFont,
            secondaryFont: profile?.typography?.secondaryFont,
          },
          piecesAnalyses: completedList.map((p) => ({
            pieceId: p.id,
            pieceType: p.piece_type,
            formatType: p.format_type,
            analysis: p.analysis_json,
          })),
        });

        await BrandDNAService.saveConsolidatedDNA(clientId, session.organizationId, consolidatedDNA, {
          sourcePieceIds: completedList.map((p) => p.id),
          createdBy: session.userId,
          promptVersion: '2.0.0',
        });
      } catch (dnaErr: any) {
        Logger.error({ operation: 'dna_consolidation_error', result: 'error' }, dnaErr);
      }
    }

    const successCount = results.filter((r) => r.status === 'completed').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    // Atualiza status final do cliente
    const finalVisualStatus = consolidatedDNA
      ? 'ready'
      : completedList.length > 0
      ? 'ready'
      : failedCount > 0
      ? 'needs_review'
      : 'awaiting_references';

    await (serviceClient as any)
      .from('clients')
      .update({
        visual_memory_status: finalVisualStatus,
        brand_status: finalVisualStatus === 'ready' ? 'ready' : 'needs_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    return NextResponse.json({
      success: true,
      analyzedCount: pieces.length,
      successCount,
      failedCount,
      results,
      dna: consolidatedDNA,
      visual_memory_status: finalVisualStatus,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
