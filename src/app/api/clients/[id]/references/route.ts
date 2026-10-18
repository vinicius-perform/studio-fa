// src/app/api/clients/[id]/references/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireClientAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { isDevStoreAllowed } from '@/config/env';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;

    if (isDevStoreAllowed()) {
      const devRefs = devStore.listBrandReferences(clientId);
      return NextResponse.json({ references: devRefs });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // Valida que o usuário tem acesso a este cliente
    await requireClientAccess(supabase, session, clientId);

    const { data: references, error } = await supabase
      .from('brand_references')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar brand_references:', error);
      return NextResponse.json(
        { error: { message: 'Não foi possível conectar ao Studio FA. Tente novamente.' } },
        { status: 503 }
      );
    }

    return NextResponse.json({ references: references || [] });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const body = await req.json();
    const { title, referenceType, tags, imageUrl, description } = body;

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: { message: 'Título e imagem da peça são obrigatórios.' } },
        { status: 400 }
      );
    }

    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const devRef = devStore.addBrandReference({
        organization_id: orgId,
        client_id: clientId,
        title: title.trim(),
        description: description?.trim() || null,
        reference_type: referenceType || 'instagram_post',
        tags: Array.isArray(tags) ? tags : [],
        image_url: imageUrl,
      });
      return NextResponse.json({ reference: devRef }, { status: 201 });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para adicionar peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const { data: newRef, error: insertErr } = await (supabase.from('brand_references') as any)
      .insert({
        organization_id: session.organizationId,
        client_id: clientId,
        title: title.trim(),
        description: description?.trim() || null,
        reference_type: referenceType || 'instagram_post',
        tags: Array.isArray(tags) ? tags : [],
        image_url: imageUrl,
        is_approved: true,
        visual_features: {},
        ai_description: null,
      })
      .select('*')
      .single();

    if (insertErr) {
      throw insertErr;
    }

    return NextResponse.json({ reference: newRef }, { status: 201 });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const { searchParams } = new URL(req.url);
    const referenceId = searchParams.get('referenceId');

    if (!referenceId) {
      return NextResponse.json({ error: { message: 'referenceId é obrigatório' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      devStore.deleteBrandReference(referenceId);
      return NextResponse.json({ success: true });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para excluir peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const { error: delErr } = await supabase
      .from('brand_references')
      .delete()
      .eq('id', referenceId)
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId);

    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
