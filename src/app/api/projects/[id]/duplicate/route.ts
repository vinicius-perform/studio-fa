// src/app/api/projects/[id]/duplicate/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireProjectAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { canCreateProjects } from '@/lib/auth/permissions';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { isDevStoreAllowed } from '@/config/env';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id;

    if (isDevStoreAllowed()) {
      const cloned = devStore.duplicateProject(projectId);
      if (!cloned) {
        return NextResponse.json({ error: { message: 'Projeto não encontrado.' } }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        project: cloned.project,
        slides: cloned.slides,
      });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (!canCreateProjects(session.role)) {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para duplicar produções.' } },
        { status: 403 }
      );
    }

    await requireProjectAccess(supabase, session, projectId);

    // 1. Fetch source project
    const { data: sourceProject, error: projErr } = await (supabase as any)
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('organization_id', session.organizationId)
      .single();

    if (projErr || !sourceProject) {
      return NextResponse.json({ error: { message: 'Projeto não encontrado.' } }, { status: 404 });
    }

    // 2. Clone project metadata (status -> draft, zero AI calls)
    const { data: clonedProject, error: cloneErr } = await (supabase as any)
      .from('projects')
      .insert({
        organization_id: session.organizationId,
        client_id: sourceProject.client_id,
        title: `${sourceProject.title} — Cópia`,
        project_type: sourceProject.project_type,
        format: sourceProject.format,
        status: 'draft',
        width: sourceProject.width,
        height: sourceProject.height,
        brief: sourceProject.brief,
        created_by: session.userId,
      })
      .select()
      .single();

    if (cloneErr || !clonedProject) {
      throw cloneErr || new Error('Falha ao duplicar projeto');
    }

    // 3. Fetch source slides
    const { data: sourceSlides } = await (supabase as any)
      .from('project_slides')
      .select('*')
      .eq('project_id', projectId)
      .order('slide_index', { ascending: true });

    const clonedSlides: any[] = [];

    if (sourceSlides && sourceSlides.length > 0) {
      const sourceSlideIds = sourceSlides.map((s: any) => s.id);
      const { data: sourceComps } = await (supabase as any)
        .from('slide_compositions')
        .select('*')
        .in('slide_id', sourceSlideIds);

      for (const slide of sourceSlides) {
        const { data: newSlide, error: slideErr } = await (supabase as any)
          .from('project_slides')
          .insert({
            organization_id: session.organizationId,
            project_id: clonedProject.id,
            slide_index: slide.slide_index,
            slide_type: slide.slide_type,
            title: slide.title,
            subtitle: slide.subtitle,
            body: slide.body,
            cta: slide.cta,
            instructions: slide.instructions,
            status: 'draft',
            preview_asset_id: slide.preview_asset_id,
            base_asset_id: slide.base_asset_id,
          })
          .select()
          .single();

        if (slideErr || !newSlide) {
          console.error('Erro ao clonar slide:', slideErr);
          continue;
        }

        clonedSlides.push(newSlide);

        // Clone composition reusing layers with new UUID and revision 1
        const origComp = ((sourceComps || []) as any[]).find((c: any) => c.slide_id === slide.id);
        if (origComp) {
          await (supabase as any)
            .from('slide_compositions')
            .insert({
              organization_id: session.organizationId,
              slide_id: newSlide.id,
              document: origComp.document,
              revision: 1,
            });
        }
      }
    }

    return NextResponse.json({
      success: true,
      project: clonedProject,
      slides: clonedSlides,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
