// src/app/api/settings/integrations/test/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin, AuthError, ForbiddenError } from '@/lib/auth/server-guards';
import { IntegrationService } from '@/services/integrations/integration.service';
import { formatError } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const body = await req.json().catch(() => ({}));
    const { apiKey } = body;

    const service = new IntegrationService(supabase);
    const result = await service.testOpenAI(session.organizationId, apiKey);

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
