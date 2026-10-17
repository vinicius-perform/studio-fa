import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const projectId = params.id;

    // 1. Fetch Project with Client
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*, client:clients(*)')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      const devProj = devStore.getProjectById(projectId);
      if (devProj) {
        return NextResponse.json(devProj);
      }
      return NextResponse.json({ error: { message: 'Projeto não encontrado' } }, { status: 404 });
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
    const clientId = (project as any)?.client_id;
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
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const projectId = params.id;
    const body = await req.json();

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

    const { data: updated, error } = await (supabase as any)
      .from('projects')
      .update(allowedUpdates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;

    // Handle slide reordering if passed in body
    if (Array.isArray(body.reorderedSlideIds)) {
      for (let i = 0; i < body.reorderedSlideIds.length; i++) {
        const slideId = body.reorderedSlideIds[i];
        await (supabase as any)
          .from('project_slides')
          .update({ slide_index: i, updated_at: new Date().toISOString() })
          .eq('id', slideId);
      }
    }

    return NextResponse.json({ project: updated });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 400 });
  }
}
