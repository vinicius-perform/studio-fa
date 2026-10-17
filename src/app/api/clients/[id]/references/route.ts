// src/app/api/clients/[id]/references/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    const supabase = getSupabaseServerClient();

    // 1. Local references (permanently stored)
    const devRefs = devStore.listBrandReferences(clientId);

    // 2. Remote references if available
    let remoteRefs: any[] = [];
    try {
      const { data: references, error } = await supabase
        .from('brand_references')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (!error && references && Array.isArray(references)) {
        remoteRefs = references;
      }
    } catch (e) {
      console.warn('Supabase references lookup failed, using devStore:', e);
    }

    const merged = [...devRefs];
    for (const r of remoteRefs) {
      if (!merged.some((dr) => dr.id === r.id)) {
        merged.push(r);
      }
    }

    return NextResponse.json({ references: merged });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    const body = await req.json();
    const { title, referenceType, tags, imageUrl, description, organizationId } = body;

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: { message: 'Título e imagem da peça são obrigatórios.' } },
        { status: 400 }
      );
    }

    const effectiveOrgId = organizationId || devStore.getOrganizationId();

    // 1. Save to devStore immediately
    const devRef = devStore.addBrandReference({
      organization_id: effectiveOrgId,
      client_id: clientId,
      title: title.trim(),
      description: description?.trim() || null,
      reference_type: referenceType || 'instagram_post',
      tags: Array.isArray(tags) ? tags : [],
      image_url: imageUrl,
    });

    // 2. Also attempt Supabase insert if available
    try {
      const supabase = getSupabaseServerClient();
      await (supabase.from('brand_references') as any).insert({
        organization_id: effectiveOrgId,
        client_id: clientId,
        title: title.trim(),
        description: description?.trim() || null,
        reference_type: referenceType || 'instagram_post',
        tags: Array.isArray(tags) ? tags : [],
        is_approved: true,
        visual_features: {},
        ai_description: null,
      });
    } catch (sbErr) {
      console.warn('Supabase brand_reference insert failed:', sbErr);
    }

    return NextResponse.json({ reference: devRef }, { status: 201 });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceId = searchParams.get('referenceId');

    if (!referenceId) {
      return NextResponse.json(
        { error: { message: 'referenceId é obrigatório' } },
        { status: 400 }
      );
    }

    devStore.deleteBrandReference(referenceId);

    try {
      const supabase = getSupabaseServerClient();
      await supabase.from('brand_references').delete().eq('id', referenceId);
    } catch (e) {
      // Ignored for dev fallback
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
