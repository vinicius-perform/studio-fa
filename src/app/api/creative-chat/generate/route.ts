// src/app/api/creative-chat/generate/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess, AuthError, ForbiddenError, NotFoundError } from '@/lib/auth/server-guards';
import { canCreateProjects } from '@/lib/auth/permissions';
import { CreativeChatService } from '@/services/ai/creative-chat.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      clientId,
      conversationId,
      userMessage,
      selectedPieceIds,
      selectedReferencePieceId,
      layoutPrintUrl,
      uploadedPieces,
      profile,
      format,
      aspectRatio,
      projectType,
      slideCount,
      selectedLogoType,
      subjectPhotoUrl,
      subjectPhotoStoragePath,
      faceCropDataUrl,
      subjectCutoutDataUrl,
      subjectCutoutStoragePath,
      personHandlingMode,
    } = body;

    if (!clientId || !userMessage?.trim()) {
      return NextResponse.json(
        { error: { message: 'clientId e userMessage são obrigatórios.' } },
        { status: 400 }
      );
    }

    // Regra Obrigatória: Referência visual é estritamente mandatória (Seção 8)
    const rawPieceIds = selectedPieceIds || (selectedReferencePieceId ? [selectedReferencePieceId] : []);
    const normalizedPieceIds = Array.isArray(rawPieceIds) ? rawPieceIds.filter(Boolean) : [];

    if (normalizedPieceIds.length === 0) {
      return NextResponse.json(
        { error: { message: 'Selecione uma referência visual para orientar a criação.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // RBAC: Visualizadores não podem criar peças
    if (!canCreateProjects(session.role)) {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura e não podem gerar peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const chatService = new CreativeChatService(supabase);
    const piece = await chatService.generateChatPiece({
      organizationId: session.organizationId,
      clientId,
      userId: session.userId,
      userMessage: userMessage.trim(),
      conversationId,
      selectedPieceIds: normalizedPieceIds,
      layoutPrintUrl,
      uploadedPieces,
      profile: profile || 'SMOKE',
      format,
      aspectRatio,
      projectType,
      slideCount,
      selectedLogoType,
      subjectPhotoUrl,
      subjectPhotoStoragePath,
      faceCropDataUrl,
      subjectCutoutDataUrl,
      subjectCutoutStoragePath,
      personHandlingMode,
    });

    return NextResponse.json({
      success: true,
      piece,
    });
  } catch (err: any) {
    console.error('[POST /api/creative-chat/generate] ERRO:', err?.stack || err?.message || err);
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message, code: 'AUTH_REQUIRED' } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message, code: 'FORBIDDEN' } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message, code: 'NOT_FOUND' } }, { status: 404 });

    const msg = err?.message || 'Falha ao gerar peça criativa.';
    if (msg.includes('[OpenAI Auth]') || msg.includes('Incorrect API key') || msg.includes('invalid_api_key')) {
      return NextResponse.json({
        error: {
          message: 'Chave de API da OpenAI inválida ou sem permissão. Verifique suas credenciais em Configurações > Integrações.',
          code: 'OPENAI_AUTH_ERROR',
          technicalDetails: msg,
        },
      }, { status: 401 });
    }
    if (msg.includes('[OpenAI Quota/Rate Limit]') || msg.includes('insufficient_quota') || msg.includes('rate_limit')) {
      return NextResponse.json({
        error: {
          message: 'Limite de requisições ou cota da OpenAI atingido. Verifique o saldo ou plano da sua conta OpenAI.',
          code: 'OPENAI_QUOTA_ERROR',
          technicalDetails: msg,
        },
      }, { status: 429 });
    }
    if (msg.includes('[OpenAI Moderation]') || msg.includes('content_policy_violation')) {
      return NextResponse.json({
        error: {
          message: 'O conteúdo solicitado ou a referência violou as diretrizes de moderação e segurança da OpenAI.',
          code: 'OPENAI_MODERATION_ERROR',
          technicalDetails: msg,
        },
      }, { status: 422 });
    }
    if (msg.includes('[OpenAI Image API]')) {
      const statusMatch = msg.match(/Status (\d{3})/);
      const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : 400;
      return NextResponse.json({
        error: {
          message: msg,
          code: 'OPENAI_IMAGE_API_ERROR',
          technicalDetails: msg,
        },
      }, { status: httpStatus });
    }

    return NextResponse.json({
      error: {
        message: msg,
        code: 'GENERATION_FAILED',
        technicalDetails: msg,
      },
    }, { status: 500 });
  }
}
