// src/app/api/jobs/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { QueueService } from '@/services/ai/queue.service';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { isDevStoreAllowed } from '@/config/env';
import {
  requireSessionContext,
  requireProjectAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: { message: 'projectId é obrigatório' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      return NextResponse.json({ jobs: devStore.listJobs(projectId) });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    await requireProjectAccess(supabase, session, projectId);

    const queueService = new QueueService(supabase);
    const jobs = await queueService.getProjectJobs(projectId, session.organizationId);

    return NextResponse.json({ jobs });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.projectId || !body.clientId || !body.slideId) {
      return NextResponse.json(
        { error: { message: 'projectId, clientId e slideId são obrigatórios' } },
        { status: 400 }
      );
    }

    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const queueService = new QueueService({} as any);
      const job = await queueService.enqueueSlideJob({
        organizationId: orgId,
        clientId: body.clientId,
        projectId: body.projectId,
        slideId: body.slideId,
        slideIndex: body.slideIndex ?? 0,
        format: body.format || 'instagram_feed_4_5',
        presetId: body.presetId || 'production',
        promptOverride: body.promptOverride,
        customVariationInstruction: body.customVariationInstruction,
        isVariation: Boolean(body.isVariation),
        userId: 'dev-user',
      });
      return NextResponse.json({ job });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura e não podem gerar imagens.' } },
        { status: 403 }
      );
    }

    await requireProjectAccess(supabase, session, body.projectId);

    const queueService = new QueueService(supabase);
    const job = await queueService.enqueueSlideJob({
      organizationId: session.organizationId,
      clientId: body.clientId,
      projectId: body.projectId,
      slideId: body.slideId,
      slideIndex: body.slideIndex ?? 0,
      format: body.format || 'instagram_feed_4_5',
      presetId: body.presetId || 'production',
      promptOverride: body.promptOverride,
      customVariationInstruction: body.customVariationInstruction,
      isVariation: Boolean(body.isVariation),
      userId: session.userId,
    });

    return NextResponse.json({ job });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
