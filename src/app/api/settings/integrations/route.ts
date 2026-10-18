// src/app/api/settings/integrations/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin, AuthError, ForbiddenError } from '@/lib/auth/server-guards';
import { IntegrationService } from '@/services/integrations/integration.service';
import { formatError } from '@/lib/errors';
import { isDevStoreAllowed } from '@/config/env';

export async function GET(req: Request) {
  try {
    if (isDevStoreAllowed()) {
      return NextResponse.json({
        openai: {
          provider: 'openai',
          configured: Boolean(process.env.OPENAI_API_KEY),
          maskedSecret: process.env.OPENAI_API_KEY
            ? `sk-env-••••••••••${process.env.OPENAI_API_KEY.slice(-4)}`
            : undefined,
          status: process.env.OPENAI_API_KEY ? 'connected' : 'unconfigured',
          lastTestedAt: null,
          settings: {
            textModel: 'gpt-4o',
            visionModel: 'gpt-4o',
            imageModel: 'dall-e-3',
          },
        },
      });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const service = new IntegrationService(supabase);
    const openaiInfo = await service.getProviderInfo(session.organizationId, 'openai');

    return NextResponse.json({
      openai: openaiInfo,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const body = await req.json();
    const { provider, apiKey, settings } = body;

    if (!provider || provider !== 'openai') {
      return NextResponse.json(
        { error: { message: 'Provedor inválido ou não suportado no momento.' } },
        { status: 400 }
      );
    }

    const service = new IntegrationService(supabase);

    // Se chave foi fornecida, salva criptografada
    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      await service.saveApiKey(session.organizationId, provider, apiKey, session.userId);
    }

    // Salva configurações de modelos se fornecidas
    if (settings && typeof settings === 'object') {
      await service.saveSettings(session.organizationId, provider, settings);
    }

    const updated = await service.getProviderInfo(session.organizationId, provider);
    return NextResponse.json({ success: true, provider: updated });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider') || 'openai';

    const service = new IntegrationService(supabase);
    await service.removeIntegration(session.organizationId, provider);

    return NextResponse.json({ success: true, message: `Integração ${provider} removida com sucesso.` });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
