// src/app/api/settings/ai/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin, AuthError, ForbiddenError } from '@/lib/auth/server-guards';
import { IntegrationService } from '@/services/integrations/integration.service';
import { isDevStoreAllowed } from '@/config/env';
import { devStore } from '@/lib/dev-store';

export async function GET() {
  try {
    if (isDevStoreAllowed()) {
      const storeKey = devStore.getSetting('openai_api_key');
      const envKey = process.env.OPENAI_API_KEY;
      const effectiveKey = envKey || storeKey || '';
      return NextResponse.json({
        configured: Boolean(effectiveKey && effectiveKey.length > 5),
        previewKey: effectiveKey ? `${effectiveKey.slice(0, 7)}...${effectiveKey.slice(-4)}` : null,
      });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const service = new IntegrationService(supabase);
    const info = await service.getProviderInfo(session.organizationId, 'openai');

    return NextResponse.json({
      configured: info.configured,
      previewKey: info.maskedSecret || null,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 5) {
      return NextResponse.json(
        { error: { message: 'Chave de API da OpenAI inválida.' } },
        { status: 400 }
      );
    }

    if (isDevStoreAllowed()) {
      devStore.setSetting('openai_api_key', apiKey.trim());
      process.env.OPENAI_API_KEY = apiKey.trim();
      return NextResponse.json({
        success: true,
        configured: true,
        previewKey: `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`,
      });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const service = new IntegrationService(supabase);
    const updated = await service.saveApiKey(session.organizationId, 'openai', apiKey, session.userId);

    return NextResponse.json({
      success: true,
      configured: updated.configured,
      previewKey: updated.maskedSecret,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
