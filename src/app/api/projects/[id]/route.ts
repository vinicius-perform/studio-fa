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
import { StorageService } from '@/services/storage/storage.service';

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

    // 2. Fetch slides, brand profile, assets, references and creative plan in parallel
    const [
      { data: slides },
      { data: brandProfile },
      { data: brandAssets },
      { data: references },
      { data: creativePlan },
      { data: clientPieces },
    ] = await Promise.all([
      (supabase as any)
        .from('project_slides')
        .select('*')
        .eq('project_id', projectId)
        .order('slide_index', { ascending: true }),
      (supabase as any)
        .from('brand_profiles')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'approved')
        .maybeSingle(),
      (supabase as any)
        .from('client_assets')
        .select('*')
        .eq('client_id', clientId)
        .in('asset_type', ['logo_primary', 'logo_secondary', 'logo_monochrome', 'font', 'icon'])
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('brand_references')
        .select('*, asset:client_assets(storage_path)')
        .eq('client_id', clientId)
        .eq('is_approved', true)
        .limit(12),
      (supabase as any)
        .from('project_creative_plans')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from('client_pieces')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ]);

    // 3. Processa URLs seguras para Brand Assets (Logos / Fontes)
    const mappedBrandAssets = await Promise.all(
      (brandAssets || []).map(async (asset: any) => {
        let signedUrl: string | null = null;
        try {
          signedUrl = await StorageService.createSignedUrl(
            asset.storage_bucket || 'client-brand-assets',
            asset.storage_path,
            7200
          );
        } catch {
          // fallback silencioso para proxy raw
        }
        const rawUrl = `/api/assets/raw?path=${encodeURIComponent(asset.storage_path)}`;
        return {
          ...asset,
          signed_url: signedUrl,
          raw_url: rawUrl,
          url: signedUrl || rawUrl,
        };
      })
    );

    // 4. Processa Referências (client_pieces + brand_references)
    const mappedPieces = await Promise.all(
      (clientPieces || []).map(async (piece: any) => {
        let imageUrl = '';
        try {
          imageUrl =
            (await StorageService.createSignedUrl(
              piece.storage_bucket || 'client-pieces',
              piece.storage_path,
              7200
            )) || `/api/assets/raw?path=${encodeURIComponent(piece.storage_path)}`;
        } catch {
          imageUrl = `/api/assets/raw?path=${encodeURIComponent(piece.storage_path)}`;
        }
        return {
          id: piece.id,
          organization_id: piece.organization_id,
          client_id: piece.client_id,
          title: piece.title || piece.original_filename || 'Peça de Referência',
          description: piece.notes || piece.original_filename || null,
          reference_type: piece.piece_type || piece.format_type || 'client_piece',
          tags: [piece.format_type, piece.piece_type].filter(Boolean),
          image_url: imageUrl,
          ai_description: (piece.analysis_json as any)?.description || null,
          visual_features: piece.analysis_json || {},
          created_at: piece.created_at,
        };
      })
    );

    const mappedLegacyRefs = (references || []).map((ref: any) => ({
      ...ref,
      image_url:
        ref.image_url ||
        (ref.asset?.storage_path ? `/api/assets/raw?path=${encodeURIComponent(ref.asset.storage_path)}` : ''),
    }));

    const pieceIds = new Set(mappedPieces.map((p) => p.id));
    const allReferences = [...mappedPieces, ...mappedLegacyRefs.filter((lr: any) => !pieceIds.has(lr.id))];

    // 5. Enriquece slides com os dados da referência selecionada
    const enrichedSlides = (slides || []).map((s: any) => {
      const meta = (s.metadata as any) || {};
      const refId = s.base_asset_id || meta.referencePieceId || meta.primaryReferencePieceId;
      const matchedRef = allReferences.find((r) => r.id === refId);
      return {
        ...s,
        reference_piece_id: refId || null,
        reference_image_url: matchedRef?.image_url || meta.referenceImageUrl || null,
        reference_title: matchedRef?.title || meta.referenceTitle || null,
      };
    });

    // 6. Fetch Compositions for slides (if any)
    const slideIds = (slides || []).map((s: any) => s.id);
    let compositions: any[] = [];
    if (slideIds.length > 0) {
      const { data: comps } = await (supabase as any)
        .from('slide_compositions')
        .select('*')
        .in('slide_id', slideIds);
      compositions = comps || [];
    }

    return NextResponse.json({
      project,
      slides: enrichedSlides,
      compositions: compositions || [],
      brandProfile,
      brandAssets: mappedBrandAssets,
      references: allReferences,
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
      if (body.archived === true) {
        allowedUpdates.archived_at = new Date().toISOString();
        allowedUpdates.status = 'archived';
      } else if (body.archived === false) {
        allowedUpdates.archived_at = null;
        allowedUpdates.status = 'draft';
      }
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
    if (body.archived === true) {
      allowedUpdates.archived_at = new Date().toISOString();
      allowedUpdates.status = 'archived';
    } else if (body.archived === false) {
      allowedUpdates.archived_at = null;
      allowedUpdates.status = 'draft';
    }

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
