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
import { isDevStoreAllowed } from '@/config/env';
import {
  requireSessionContext,
  requireClientAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { isAdmin } from '@/lib/auth/permissions';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');
  const format = searchParams.get('format');
  const search = searchParams.get('search');

  try {
    if (isDevStoreAllowed()) {
      const localProjects = devStore.listProjects(clientId || undefined, status || undefined);
      return NextResponse.json({ projects: localProjects });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // Se filtrou por um cliente específico, valida se tem acesso a ele
    if (clientId) {
      await requireClientAccess(supabase, session, clientId);
    }

    let query = supabase
      .from('projects')
      .select('*, client:clients(name, slug, brand_status), slides:project_slides(id, slide_index, status)')
      .eq('organization_id', session.organizationId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    // Designers e Viewers enxergam apenas projetos de clientes atribuídos
    if (!isAdmin(session.role)) {
      if (session.assignedClientIds.length === 0) {
        return NextResponse.json({ projects: [] });
      }
      query = query.in('client_id', session.assignedClientIds);
    }

    if (clientId) query = query.eq('client_id', clientId);
    if (status) query = query.eq('status', status as any);
    if (format) query = query.eq('format', format as any);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data: projects, error } = await query;
    if (error) {
      console.error('Erro ao listar projetos no Supabase:', error);
      return NextResponse.json(
        { error: { message: 'Não foi possível conectar ao Studio FA. Tente novamente.' } },
        { status: 503 }
      );
    }

    return NextResponse.json({ projects: projects || [] });
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
    const {
      clientId,
      title,
      projectType,
      format,
      slides,
      globalCreativeDirective,
    } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: { message: 'clientId é obrigatório' } },
        { status: 400 }
      );
    }

    const formatDef = getFormatDefinition(format || 'instagram_feed_4_5');
    const aiProvider = new OpenAIProvider();
    const compositionService = new CompositionService({} as any);

    // Helper para gerar backgrounds editoriais
    const generateSlideBackground = async (
      fmt: any,
      profile: any,
      slide: any,
      index: number,
      total: number
    ): Promise<string | undefined> => {
      try {
        const prompt = PromptCompiler.compile({
          brandProfile: profile || {
            summary: 'Editorial contemporâneo sofisticado Studio FA',
            colors: { primary: ['#0B0F17'], accent: ['#CEF52A'], background: ['#121820', '#1E2630'] },
          },
          format: fmt,
          slidePlan: {
            visualConcept: 'Fundo editorial contemporâneo',
            layout: {
              title: { x: 80, y: 120, width: 800, align: 'left' },
            },
          },
          content: {
            title: slide.title,
            subtitle: slide.subtitle,
            body: slide.body,
            cta: slide.cta,
          },
        });

        const imageRes = await aiProvider.generateImage({
          prompt: prompt.prompt,
          brandProfile: profile || { colors: { primary: ['#0B0F17'], accent: ['#CEF52A'] } },
          dimensions: { width: fmt.generationWidth, height: fmt.generationHeight },
        });

        return imageRes.imageUrl;
      } catch (e) {
        console.warn(`Fallback local gerado para slide ${index + 1}:`, e);
        return undefined;
      }
    };

    // 1. Modo DevStore explícito
    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const localClient = devStore.getClientById(clientId);
      const projectId = `proj-${Date.now()}`;
      const projectTitle =
        title ||
        `${projectType === 'carousel' ? 'Carrossel' : 'Post'} — ${new Date().toLocaleDateString('pt-BR')}`;

      const newProject = {
        id: projectId,
        organization_id: orgId,
        client_id: clientId,
        title: projectTitle,
        project_type: projectType || 'single_post',
        format: format || 'instagram_feed_4_5',
        status: 'draft',
        width: formatDef.exportWidth,
        height: formatDef.exportHeight,
        brief: globalCreativeDirective || null,
        created_by: 'dev-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      const slidesData =
        slides && slides.length > 0 ? slides : [{ slideIndex: 0, title: title || 'Título' }];
      const createdSlides = [];
      const createdComps = [];

      for (let i = 0; i < slidesData.length; i++) {
        const s = slidesData[i];
        const slideId = `slide-${Date.now()}-${i}`;
        const slideRow = {
          id: slideId,
          organization_id: orgId,
          project_id: projectId,
          slide_index: i,
          slide_type: i === 0 ? 'cover' : i === slidesData.length - 1 ? 'cta' : 'content',
          title: s.title || null,
          subtitle: s.subtitle || null,
          body: s.body || null,
          cta: s.cta || null,
          instructions: s.instructions || null,
          base_asset_id: s.baseAssetId || null,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const generatedBg = await generateSlideBackground(
          formatDef,
          localClient?.brandProfile,
          s,
          i,
          slidesData.length
        );

        const defaultDoc = await compositionService.initializeDefaultDocument({
          format: formatDef,
          brandProfile: localClient?.brandProfile ? (localClient.brandProfile as any) : null,
          content: {
            title: s.title,
            subtitle: s.subtitle,
            body: s.body,
            cta: s.cta,
          },
          clientLogoUrl: localClient?.logoAsset?.storage_path || undefined,
          backgroundUrl: generatedBg || s.backgroundUrl,
        });

        createdSlides.push(slideRow);
        createdComps.push({
          id: `comp-${Date.now()}-${i}`,
          slide_id: slideId,
          document: defaultDoc,
          revision: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      devStore.addProject(newProject, createdSlides, createdComps);
      return NextResponse.json({ project: newProject, slides: createdSlides }, { status: 201 });
    }

    // 2. Supabase oficial
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para criar produções.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const projectService = new ProjectService(supabase);
    const serverCompService = new CompositionService(supabase);

    const project = await projectService.create(
      {
        organization_id: session.organizationId,
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
      session.userId
    );

    // Busca brand profile e assets do cliente
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

    const createdSlides = [];
    const slidesData =
      slides && slides.length > 0 ? slides : [{ slideIndex: 0, title: title || 'Título' }];

    for (let i = 0; i < slidesData.length; i++) {
      const s = slidesData[i];
      const slideRow = await projectService.addSlide({
        organization_id: session.organizationId,
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

      const defaultDoc = await serverCompService.initializeDefaultDocument({
        format: formatDef,
        brandProfile: brandProfile ? (brandProfile as any) : null,
        content: {
          title: s.title,
          subtitle: s.subtitle,
          body: s.body,
          cta: s.cta,
        },
        clientLogoUrl: (logoAsset as any)?.storage_path || undefined,
        backgroundUrl: generatedBg || s.backgroundUrl,
      });

      await serverCompService.saveComposition({
        slideId: slideRow.id,
        projectId: project.id,
        organizationId: session.organizationId,
        document: defaultDoc,
        expectedRevision: 1,
        userId: session.userId,
      });

      createdSlides.push(slideRow);
    }

    return NextResponse.json({ project, slides: createdSlides }, { status: 201 });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
