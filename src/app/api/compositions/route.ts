// src/app/api/compositions/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { CompositionService } from '@/services/compositions/composition.service';
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
    const slideId = searchParams.get('slideId');

    if (!slideId) {
      return NextResponse.json({ error: { message: 'slideId é obrigatório' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      const devComp = devStore.getComposition(slideId);
      if (devComp) {
        return NextResponse.json({ composition: devComp });
      }
      return NextResponse.json({ composition: null });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // Valida acesso à lâmina e projeto
    const { data: slideData, error: slideErr } = await (supabase as any)
      .from('project_slides')
      .select('project_id, organization_id')
      .eq('id', slideId)
      .maybeSingle();

    const slide = slideData as any;

    if (slideErr || !slide) {
      return NextResponse.json({ error: { message: 'Lâmina não encontrada.' } }, { status: 404 });
    }

    await requireProjectAccess(supabase, session, slide.project_id);

    const service = new CompositionService(supabase);
    const comp = await service.getBySlideId(slideId, session.organizationId);

    return NextResponse.json({ composition: comp });
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
    const { slideId, projectId, document, expectedRevision } = body;

    if (!slideId) {
      return NextResponse.json({ error: { message: 'slideId é obrigatório' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      const devComp = devStore.updateComposition(
        slideId,
        document,
        expectedRevision ?? 1
      );
      return NextResponse.json({ composition: devComp });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // Visualizadores não podem modificar composições
    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura e não podem alterar composições.' } },
        { status: 403 }
      );
    }

    // Identifica o projeto para verificar permissão
    let targetProjectId = projectId;
    if (!targetProjectId) {
      const { data: slideData } = await (supabase as any)
        .from('project_slides')
        .select('project_id')
        .eq('id', slideId)
        .maybeSingle();
      targetProjectId = (slideData as any)?.project_id;
    }

    if (!targetProjectId) {
      return NextResponse.json({ error: { message: 'Projeto associado à lâmina não foi encontrado.' } }, { status: 404 });
    }

    await requireProjectAccess(supabase, session, targetProjectId);

    const service = new CompositionService(supabase);
    const saved = await service.saveComposition({
      slideId,
      projectId: targetProjectId,
      organizationId: session.organizationId,
      document,
      expectedRevision: expectedRevision ?? 1,
      userId: session.userId,
    });

    return NextResponse.json({ composition: saved });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
