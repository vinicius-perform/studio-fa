// src/app/api/creative-chat/upload/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess, AuthError, ForbiddenError, NotFoundError } from '@/lib/auth/server-guards';
import { canCreateProjects } from '@/lib/auth/permissions';
import { StorageService } from '@/services/storage/storage.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, fileBase64, filename, isLayoutPrint, isSubjectPhoto, title } = body;

    if (!clientId || !fileBase64) {
      return NextResponse.json(
        { error: { message: 'clientId e fileBase64 são obrigatórios.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (!canCreateProjects(session.role)) {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura e não podem fazer upload de referências.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const safeFilename =
      filename ||
      (isSubjectPhoto
        ? 'foto-cliente.png'
        : isLayoutPrint
        ? 'print-estrutura.png'
        : 'referencia-chat.png');

    const folderName = isLayoutPrint ? 'references' : 'pieces';

    const uploadResult = await StorageService.uploadBase64({
      bucket: 'client-pieces',
      organizationId: session.organizationId,
      clientId,
      folder: folderName,
      originalFilename: safeFilename,
      base64Data: fileBase64,
    });

    // Registra em client_pieces para persistência
    const { data: pieceRow, error: insertErr } = await (supabase as any)
      .from('client_pieces')
      .insert({
        organization_id: session.organizationId,
        client_id: clientId,
        title:
          title ||
          (isSubjectPhoto
            ? 'Foto do Cliente (Objeto Principal)'
            : isLayoutPrint
            ? 'Print de Estrutura / Layout'
            : 'Referência do Chat'),
        original_filename: safeFilename,
        storage_bucket: uploadResult.storageBucket,
        storage_path: uploadResult.storagePath,
        file_size_bytes: uploadResult.fileSizeBytes,
        mime_type: uploadResult.mimeType,
        format_type: 'custom',
        piece_type: isSubjectPhoto ? 'own_brand' : isLayoutPrint ? 'external_reference' : 'own_brand',
        analysis_status: 'pending',
        created_by: session.userId,
      })
      .select()
      .single();

    if (insertErr) {
      console.warn('[POST /api/creative-chat/upload] Aviso ao inserir client_piece:', insertErr.message);
    }

    const signedUrl = await StorageService.createSignedUrl(
      uploadResult.storageBucket,
      uploadResult.storagePath,
      86400
    );

    return NextResponse.json({
      success: true,
      piece: {
        id: pieceRow?.id || `upload-${Date.now()}`,
        title:
          title ||
          (isSubjectPhoto
            ? 'Foto do Cliente (Objeto Principal)'
            : isLayoutPrint
            ? 'Print de Estrutura'
            : 'Referência'),
        url: signedUrl,
        storagePath: uploadResult.storagePath,
        isLayoutPrint: Boolean(isLayoutPrint),
        isSubjectPhoto: Boolean(isSubjectPhoto),
      },
    });
  } catch (err: any) {
    console.error('[POST /api/creative-chat/upload] ERRO:', err?.message || err);
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json({ error: { message: err?.message || 'Falha ao processar upload.' } }, { status: 500 });
  }
}
