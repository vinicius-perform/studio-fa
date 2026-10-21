// src/app/api/creative-chat/analyze/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess, AuthError, ForbiddenError, NotFoundError } from '@/lib/auth/server-guards';
import { CreativeChatService } from '@/services/ai/creative-chat.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, selectedPieceIds, uploadedPieces, customInstruction } = body;

    if (!clientId) {
      return NextResponse.json({ error: { message: 'clientId é obrigatório.' } }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);
    await requireClientAccess(supabase, session, clientId);

    const chatService = new CreativeChatService(supabase);
    const report = await chatService.analyzeVisualMemory({
      organizationId: session.organizationId,
      clientId,
      selectedPieceIds,
      uploadedPieces,
      customInstruction,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    console.error('[POST /api/creative-chat/analyze] ERRO:', err?.message || err);
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json({ error: { message: err?.message || 'Falha ao analisar referências do cliente.' } }, { status: 500 });
  }
}
