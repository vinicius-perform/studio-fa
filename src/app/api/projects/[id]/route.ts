// src/app/api/projects/[id]/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireProjectAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { isDevStoreAllowed } from '@/config/env';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id;

    if (isDevStoreAllowed()) {
      const devProj = devStore.getProjectById(projectId);
      if (devProj) {
        return NextResponse.json(devProj);
      }
      return NextResponse.json({ error: { message: 'Projeto não encontrado.' } }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // Valida que o usuário tem permissão para acessar o projeto (e o cliente dele)
    const { clientId } = await requireProjectAccess(supabase, session, projectId);

    // 1. Fetch Project with Client
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*, client:clients(*)')
      .eq('id', projectId)
      .eq('organization_id', session.organizationId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: { message: 'Projeto não encontrado.' } }, { status: 404 });
    }

    // 2. Fetch Slides ordered by slide_index
    const { data: slides } = await supabase
      .from('project_slides')
      .select('*')
      .eq('project_id', projectId)
      .order('slide_index', { ascending: true });

    // 3. Fetch Compositions for all slides
    const slideIds = (slides || []).map((s: any) => s.id);
    const { data: compositions } = await supabase
      .from('slide_compositions')
      .select('*')
      .in('slide_id', slideIds);

    // 4. Fetch Client Brand Profile
    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'approved')
      .maybeSingle();

    // 5. Fetch Client Logos & Assets
    const { data: brandAssets } = await supabase
      .from('client_assets')
      .select('*')
      .eq('client_id', clientId)
      .in('asset_type', ['logo_primary', 'logo_secondary', 'logo_monochrome', 'font', 'icon'])
      .order('created_at', { ascending: false });

    // 6. Fetch Client Brand References
    const { data: references } = await supabase
      .from('brand_references')
      .select('*, asset:client_assets(storage_path)')
      .eq('client_id', clientId)
      .eq('is_approved', true)
      .limit(12);

    // 7. Fetch Creative Plan
    const { data: creativePlan } = await supabase
      .from('project_creative_plans')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      project,
      slides: slides || [],
      compositions: compositions || [],
      brandProfile,
      brandAssets: brandAssets || [],
      references: references || [],
      creativePlan,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id;
    const body = await req.json();

    if (isDevStoreAllowed()) {
      const allowedUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.title) allowedUpdates.title = body.title;
      if (body.status) allowedUpdates.status = body.status;
      if (body.brief !== undefined) allowedUpdates.brief = body.brief;
      const devUpdated = devStore.updateProject(projectId, allowedUpdates);
      return NextResponse.json({ project: devUpdated });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura.' } },
        { status: 403 }
      );
    }

    await requireProjectAccess(supabase, session, projectId);

    const allowedUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title) allowedUpdates.title = body.title;
    if (body.status) {
      allowedUpdates.status = body.status;
      if (body.status === 'approved') {
        allowedUpdates.approved_at = new Date().toISOString();
      }
    }
    if (body.brief !== undefined) allowedUpdates.brief = body.brief;

    const { data: updated, error: updErr } = await (supabase as any)
      .from('projects')
      .update(allowedUpdates)
      .eq('id', projectId)
      .eq('organization_id', session.organizationId)
      .select()
      .single();

    if (updErr) throw updErr;

    // Handle slide reordering if passed in body
    if (Array.isArray(body.reorderedSlideIds)) {
      for (let i = 0; i < body.reorderedSlideIds.length; i++) {
        const slideId = body.reorderedSlideIds[i];
        await (supabase as any)
          .from('project_slides')
          .update({ slide_index: i, updated_at: new Date().toISOString() })
          .eq('id', slideId)
          .eq('project_id', projectId);
      }
    }

    return NextResponse.json({ project: updated });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id;

    if (isDevStoreAllowed()) {
      devStore.deleteProject(projectId);
      return NextResponse.json({ success: true, message: 'Projeto removido com sucesso.' });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura.' } },
        { status: 403 }
      );
    }

    await requireProjectAccess(supabase, session, projectId);

    const { error: delErr } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('organization_id', session.organizationId);

    if (delErr) throw delErr;

    return NextResponse.json({ success: true, message: 'Projeto removido com sucesso.' });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
