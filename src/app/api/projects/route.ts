// src/app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ProjectService } from '@/services/projects/project.service';
import { CompositionService } from '@/services/compositions/composition.service';
import { getFormatDefinition } from '@/config/formats';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { OpenAIProvider } from '@/services/ai/openai.provider';
import { PromptCompiler } from '@/services/ai/prompt-compiler';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');
  const format = searchParams.get('format');
  const search = searchParams.get('search');

  try {
    const supabase = getSupabaseServerClient();

    let orgId = searchParams.get('organizationId');
    if (!orgId) {
      try {
        const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
        orgId = (org as any)?.id || null;
      } catch {
        orgId = null;
      }
    }

    const localProjects = devStore.listProjects(clientId || undefined, status || undefined);
    let remoteProjects: any[] = [];

    if (orgId) {
      try {
        let query = supabase
          .from('projects')
          .select('*, client:clients(name, slug, brand_status), slides:project_slides(id, slide_index, status)')
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .order('updated_at', { ascending: false });

        if (clientId) query = query.eq('client_id', clientId);
        if (status) query = query.eq('status', status as any);
        if (format) query = query.eq('format', format as any);
        if (search) query = query.ilike('title', `%${search}%`);

        const { data: projects, error } = await query;
        if (!error && projects && Array.isArray(projects)) {
          remoteProjects = projects;
        }
      } catch (e) {
        console.warn('Supabase projects query failed, using devStore:', e);
      }
    }

    const merged = [...localProjects];
    for (const p of remoteProjects) {
      if (!merged.some((lp) => lp.id === p.id)) {
        merged.push(p);
      }
    }

    return NextResponse.json({ projects: merged });
  } catch (err) {
    return NextResponse.json({ projects: devStore.listProjects(clientId || undefined, status || undefined) });
  }
}

async function generateSlideBackground(
  formatDef: any,
  brandProfile: any,
  slideData: any,
  slideIndex: number,
  totalSlides: number
): Promise<string | undefined> {
  const provider = new OpenAIProvider();

  const effectiveBrandProfile = brandProfile || {
    summary: 'Identidade visual moderna com estética minimalista e alto contraste',
    colors: { primary: ['#0B0F17'], secondary: ['#1F2937'], accent: ['#CEF52A'], background: ['#FAFAFA'], text: ['#FFFFFF'] },
    typography: { detectedFonts: ['Inter'] },
    visualStyle: { mood: ['Profissional', 'Premium'], keywords: ['Minimalista', 'Contemporâneo'] },
    photography: { lighting: 'Iluminação direcional suave', style: 'Editorial de alto padrão' },
    graphicalElements: { patterns: ['Texturas sutis e limpas'] },
  };

  const compiled = PromptCompiler.compile({
    brandProfile: effectiveBrandProfile,
    format: formatDef,
    slidePlan: {
      slideIndex,
      slideType: slideIndex === 0 ? 'cover' : slideIndex === totalSlides - 1 ? 'cta' : 'content',
      visualConcept: slideData.instructions || slideData.title || 'Visual conceitual de alto impacto',
      imageStrategy: 'generate_new_image',
      imagePrompt: slideData.title || 'Cenário conceitual e sofisticado',
      layout: {
        title: { x: 0.08, y: 0.25, width: 0.75, align: 'left' },
      },
    },
    content: {
      title: slideData.title || undefined,
      subtitle: slideData.subtitle || undefined,
      body: slideData.body || undefined,
      cta: slideData.cta || undefined,
      instructions: slideData.instructions || undefined,
    },
    referenceImageUrl: slideData.referenceImageUrl,
    referenceTitle: slideData.referenceTitle,
    pinnedReferencesDescriptions: slideData.referenceTitle ? [slideData.referenceTitle] : [],
  });

  try {
    const genOutput = await provider.generateImage({
      prompt: compiled.prompt,
      brandProfile: effectiveBrandProfile,
      dimensions: { width: formatDef.generationWidth, height: formatDef.generationHeight },
    });
    return genOutput.imageUrl;
  } catch (err) {
    console.warn('Geração automática de imagem na criação:', err);
    return undefined;
  }
}

export async function POST(req: Request) {
  try {
    let supabase: any = null;
    let user: any = null;
    try {
      supabase = getSupabaseServerClient();
      const authRes = await supabase.auth.getUser();
      user = authRes?.data?.user;
    } catch {
      // Offline or Dev mode
    }

    const body = await req.json();
    const {
      organizationId,
      clientId,
      title,
      projectType,
      format,
      globalCreativeDirective,
      slides,
    } = body;

    const effectiveOrgId = organizationId || devStore.getOrganizationId();
    const formatDef = getFormatDefinition(format || 'instagram_feed_4_5');
    const compositionService = new CompositionService(supabase || ({} as any));

    // 1. Try Supabase flow
    if (supabase) {
      try {
        const projectService = new ProjectService(supabase);

      const project = await projectService.create(
        {
          organization_id: effectiveOrgId,
          client_id: clientId,
          title:
            title ||
            `${projectType === 'carousel' ? 'Carrossel' : 'Post'} — ${new Date().toLocaleDateString('pt-BR')}`,
          project_type: projectType || 'single_post',
          format: format || 'instagram_feed_4_5',
          status: 'draft',
          width: formatDef.exportWidth,
          height: formatDef.exportHeight,
          brief: globalCreativeDirective || null,
        },
        user?.id || 'anonymous-designer'
      );

      // Fetch client profile if available
      const { data: brandProfile } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'approved')
        .maybeSingle();

      const { data: logoAsset } = await supabase
        .from('client_assets')
        .select('storage_path')
        .eq('client_id', clientId)
        .in('asset_type', ['logo_primary', 'logo_monochrome'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from('project_slides').delete().eq('project_id', project.id);

      const createdSlides = [];
      const createdComps = [];
      const slidesData =
        slides && slides.length > 0 ? slides : [{ slideIndex: 0, title: title || 'Título' }];

      for (let i = 0; i < slidesData.length; i++) {
        const s = slidesData[i];
        const slideRow = await projectService.addSlide({
          organization_id: effectiveOrgId,
          project_id: project.id,
          slide_index: i,
          slide_type: i === 0 ? 'cover' : i === slidesData.length - 1 ? 'cta' : 'content',
          title: s.title || null,
          subtitle: s.subtitle || null,
          body: s.body || null,
          cta: s.cta || null,
          instructions: s.instructions || null,
          base_asset_id: s.baseAssetId || null,
          status: 'draft',
        });

        const generatedBg = await generateSlideBackground(
          formatDef,
          brandProfile,
          s,
          i,
          slidesData.length
        );

        const defaultDoc = await compositionService.initializeDefaultDocument({
          format: formatDef,
          brandProfile: brandProfile ? (brandProfile as any) : null,
          content: {
            title: s.title,
            subtitle: s.subtitle,
            body: s.body,
            cta: s.cta,
          },
          clientLogoUrl: (logoAsset as any)?.storage_path
            ? `/api/assets/raw?path=${encodeURIComponent((logoAsset as any).storage_path)}`
            : undefined,
          backgroundUrl: generatedBg || s.backgroundUrl,
        });

        await compositionService.saveComposition({
          slideId: slideRow.id,
          projectId: project.id,
          organizationId: effectiveOrgId,
          document: defaultDoc,
          expectedRevision: 1,
          userId: user?.id || 'anonymous-designer',
        });

        createdSlides.push(slideRow);
        createdComps.push({ slide_id: slideRow.id, document: defaultDoc, revision: 1 });
      }

      // Sync to devStore
      devStore.addProject(project, createdSlides, createdComps);

      return NextResponse.json({
        project: {
          ...project,
          slides: createdSlides,
        },
      });
    } catch (sbErr) {
      console.warn('Supabase project creation failed, creating in devStore:', sbErr);
    }
  }

  // DevStore Fallback
  const devProjId = `proj-${Date.now()}`;
      const now = new Date().toISOString();
      const devProj = {
        id: devProjId,
        organization_id: effectiveOrgId,
        client_id: clientId,
        title:
          title ||
          `${projectType === 'carousel' ? 'Carrossel' : 'Post'} — ${new Date().toLocaleDateString('pt-BR')}`,
        project_type: projectType || 'single_post',
        format: format || 'instagram_feed_4_5',
        status: 'draft',
        width: formatDef.exportWidth,
        height: formatDef.exportHeight,
        brief: globalCreativeDirective || null,
        created_at: now,
        updated_at: now,
      };

      const devSlidesData =
        slides && slides.length > 0 ? slides : [{ slideIndex: 0, title: title || 'Título' }];
      const devCreatedSlides = [];
      const devCreatedComps = [];

      const client = devStore.getClientById(clientId);
      const brandProfile = client?.brandProfile;
      const clientLogoUrl = client?.logoAsset?.storage_path;

      for (let i = 0; i < devSlidesData.length; i++) {
        const s = devSlidesData[i];
        const slideId = `slide-${devProjId}-${i}`;
        const slideRow = {
          id: slideId,
          organization_id: effectiveOrgId,
          project_id: devProjId,
          slide_index: i,
          slide_type: i === 0 ? 'cover' : i === devSlidesData.length - 1 ? 'cta' : 'content',
          title: s.title || null,
          subtitle: s.subtitle || null,
          body: s.body || null,
          cta: s.cta || null,
          instructions: s.instructions || null,
          status: 'draft',
          created_at: now,
          updated_at: now,
        };

        const generatedBg = await generateSlideBackground(
          formatDef,
          brandProfile,
          s,
          i,
          devSlidesData.length
        );

        const defaultDoc = await compositionService.initializeDefaultDocument({
          format: formatDef,
          brandProfile: brandProfile ? (brandProfile as any) : null,
          content: {
            title: s.title,
            subtitle: s.subtitle,
            body: s.body,
            cta: s.cta,
          },
          clientLogoUrl,
          backgroundUrl: generatedBg || s.backgroundUrl,
        });

        devCreatedSlides.push(slideRow);
        devCreatedComps.push({ slide_id: slideId, document: defaultDoc, revision: 1 });
      }

      devStore.addProject(devProj, devCreatedSlides, devCreatedComps);

      return NextResponse.json({
        project: {
          ...devProj,
          slides: devCreatedSlides,
        },
      });
  } catch (err) {
    console.error('Projects POST error:', err);
    return NextResponse.json(formatError(err), { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let projectId = searchParams.get('id');

    if (!projectId) {
      try {
        const body = await req.json();
        projectId = body.id || body.projectId;
      } catch {
        // Ignored
      }
    }

    if (!projectId) {
      return NextResponse.json(
        { error: { message: 'ID do projeto é obrigatório para exclusão.' } },
        { status: 400 }
      );
    }

    // 1. Delete from devStore
    devStore.deleteProject(projectId);

    // 2. Also attempt Supabase delete if available
    try {
      const supabase = getSupabaseServerClient();
      await supabase.from('project_slides').delete().eq('project_id', projectId);
      await supabase.from('projects').delete().eq('id', projectId);
    } catch (e) {
      console.warn('Supabase delete project failed:', e);
    }

    return NextResponse.json({ success: true, message: 'Rascunho excluído com sucesso.' });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
