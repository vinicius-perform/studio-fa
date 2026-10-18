// src/app/api/clients/[id]/pieces/route.ts
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
import { VisualAnalyzerService } from '@/services/ai/visual-analyzer.service';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    await requireClientAccess(supabase, session, clientId);

    const { data: piecesData, error: piecesErr } = await (supabase as any)
      .from('client_pieces')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false });

    if (piecesErr) {
      return NextResponse.json({ error: { message: piecesErr.message } }, { status: 500 });
    }

    const pieces = (piecesData || []) as any[];

    // Gera Signed URLs com expiração segura (3600 segundos) para cada peça
    const signedPieces = await Promise.all(
      pieces.map(async (piece) => {
        let signedUrl: string | null = null;
        if (piece.storage_path) {
          signedUrl = await StorageService.createSignedUrl(
            piece.storage_bucket || 'client-pieces',
            piece.storage_path,
            3600
          );
        }
        return {
          ...piece,
          signedUrl,
        };
      })
    );

    return NextResponse.json({ pieces: signedPieces });
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
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para enviar peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const body = await req.json();
    const rawPieces = Array.isArray(body?.pieces) ? body.pieces : [body];

    if (rawPieces.length === 0) {
      return NextResponse.json(
        { error: { message: 'Nenhuma peça de referência enviada.' } },
        { status: 400 }
      );
    }

    const piecesToProcess = rawPieces.slice(0, 30);
    const orgId = session.organizationId;
    const createdPieces: any[] = [];

    for (const piece of piecesToProcess) {
      const rawData = piece.base64 || piece.dataUrl;
      if (!rawData) continue;

      const uploadResult = await StorageService.uploadBase64({
        bucket: 'client-pieces',
        organizationId: orgId,
        clientId,
        folder: 'pieces',
        originalFilename: piece.filename || 'referencia.png',
        base64Data: rawData,
        mimeType: piece.mimeType,
      });

      const detected = VisualAnalyzerService.detectFormat(piece.width, piece.height, piece.filename);
      const formatType = piece.formatType || detected.formatType;
      const pieceType = piece.pieceType || 'own_brand';

      const { data: inserted, error: insertErr } = await (supabase as any)
        .from('client_pieces')
        .insert({
          organization_id: orgId,
          client_id: clientId,
          title: piece.title || null,
          original_filename: piece.filename || 'referencia.png',
          storage_bucket: uploadResult.storageBucket,
          storage_path: uploadResult.storagePath,
          file_size_bytes: uploadResult.fileSizeBytes,
          mime_type: uploadResult.mimeType,
          width: piece.width || null,
          height: piece.height || null,
          aspect_ratio: piece.aspectRatio || detected.aspectRatio,
          format_type: formatType,
          piece_type: pieceType,
          analysis_status: 'pending',
          created_by: session.userId,
        })
        .select('*')
        .single();

      if (insertErr) {
        throw new Error(`Falha ao salvar registro da peça: ${insertErr.message}`);
      }

      const signedUrl = await StorageService.createSignedUrl(
        uploadResult.storageBucket,
        uploadResult.storagePath
      );

      createdPieces.push({
        ...inserted,
        signedUrl,
      });
    }

    // Atualiza status do cliente para aguardando análise
    await (supabase as any)
      .from('clients')
      .update({
        visual_memory_status: 'awaiting_analysis',
        brand_status: 'collecting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    return NextResponse.json({
      success: true,
      count: createdPieces.length,
      pieces: createdPieces,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
