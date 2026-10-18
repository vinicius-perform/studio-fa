// src/app/api/settings/integrations/supabase-health/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin, AuthError, ForbiddenError } from '@/lib/auth/server-guards';
import { IntegrationService } from '@/services/integrations/integration.service';
import { formatError } from '@/lib/errors';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    await requireAdmin(supabase);

    const health = await IntegrationService.checkSupabaseHealth(supabase);
    return NextResponse.json(health);
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
