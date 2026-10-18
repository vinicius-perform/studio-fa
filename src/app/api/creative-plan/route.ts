// src/app/api/creative-plan/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { CreativePlannerService } from '@/services/ai/creative-planner.service';
import { getFormatDefinition } from '@/config/formats';
import { formatError } from '@/lib/errors';
import {
  requireSessionContext,
  requireProjectAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura.' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      projectId,
      clientId,
      brandProfile,
      format,
      projectType,
      globalCreativeDirective,
      slides,
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: { message: 'projectId é obrigatório' } }, { status: 400 });
    }

    await requireProjectAccess(supabase, session, projectId);

    const planner = new CreativePlannerService(supabase);
    const formatDef = getFormatDefinition(format);

    const result = await planner.generatePlan({
      organizationId: session.organizationId,
      projectId,
      clientId,
      brandProfile,
      format: formatDef,
      projectType: projectType || 'single_post',
      globalCreativeDirective,
      slides: slides || [],
      userId: session.userId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 400 });
  }
}
