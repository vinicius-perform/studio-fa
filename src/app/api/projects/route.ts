import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ProjectService } from '@/services/projects/project.service';
import { CompositionService } from '@/services/compositions/composition.service';
import { CreativeContextService } from '@/services/ai/creative-context.service';
import { ImageGenerationService } from '@/services/ai/image-generation.service';
import { StorageService } from '@/services/storage/storage.service';
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
import { isAdmin, canCreateProjects } from '@/lib/auth/permissions';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');
  const format = searchParams.get('format');
  const search = searchParams.get('search');
  const archived = searchParams.get('archived');

  try {
    if (isDevStoreAllowed()) {
      const localProjects = devStore.listProjects(
        clientId || undefined,
        status || undefined,
        format || undefined,
        archived === 'true'
      );
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
      .select('*, client:clients(name, slug, brand_status), slides:project_slides(id, slide_index, status, base_asset_id)')
      .eq('organization_id', session.organizationId)
      .order('updated_at', { ascending: false });

    if (archived === 'true' || status === 'archived') {
      query = query.not('archived_at', 'is', null);
    } else {
      query = query.is('archived_at', null);
      if (status && status !== 'all') {
        query = query.eq('status', status as any);
      }
    }

    // Designers e Viewers enxergam apenas projetos de clientes atribuídos
    if (!isAdmin(session.role)) {
      if (session.assignedClientIds.length === 0) {
        return NextResponse.json({ projects: [] });
      }
      query = query.in('client_id', session.assignedClientIds);
    }

    if (clientId) query = query.eq('client_id', clientId);
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

    const projectsList = (projects || []) as any[];
    // Batch fetch slide 0 compositions to extract thumbnails without N+1
    if (projectsList.length > 0) {
      const slide0Ids: string[] = [];
      const slideIdToProjectMap = new Map<string, any>();

      for (const p of projectsList) {
        const sortedSlides = (p.slides || []).sort((a: any, b: any) => a.slide_index - b.slide_index);
        if (sortedSlides.length > 0) {
          slide0Ids.push(sortedSlides[0].id);
          slideIdToProjectMap.set(sortedSlides[0].id, p);
        }
      }

      if (slide0Ids.length > 0) {
        const { data: comps } = await (supabase as any)
          .from('slide_compositions')
          .select('slide_id, document')
          .in('slide_id', slide0Ids);

        if (comps) {
          for (const c of comps as any[]) {
            const p = slideIdToProjectMap.get(c.slide_id);
            if (p && (c as any).document?.layers) {
              const bgLayer = (c as any).document.layers.find(
                (l: any) => l.type === 'background' || l.type === 'image'
              );
              if (bgLayer?.imageUrl) {
                p.thumbnail_url = bgLayer.imageUrl;
              }
            }
          }
        }
      }

      // Fallback para metadados salvos pelo Chat Criativo caso não haja composição ainda
      for (const p of projectsList) {
        if (!p.thumbnail_url && p.metadata?.thumbnail_url) {
          p.thumbnail_url = p.metadata.thumbnail_url;
        }
      }
    }

    return NextResponse.json({ projects: projectsList });
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
      width,
      height,
    } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: { message: 'clientId é obrigatório' } },
        { status: 400 }
      );
    }

    const formatDef = getFormatDefinition(format || 'instagram_feed_4_5', width, height);
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

    if (!canCreateProjects(session.role)) {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura e não podem criar produções.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const projectService = new ProjectService(supabase);
    const serverCompService = new CompositionService(supabase);
    const contextService = new CreativeContextService(supabase);
    const imageGenService = new ImageGenerationService(supabase);

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
      .select('storage_path, storage_bucket')
      .eq('client_id', clientId)
      .in('asset_type', ['logo_primary', 'logo_monochrome'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const logoData = logoAsset as any;
    let clientLogoSignedUrl: string | undefined = undefined;
    if (logoData?.storage_path) {
      clientLogoSignedUrl = (await StorageService.createSignedUrl(
        logoData.storage_bucket || 'client-brand-assets',
        logoData.storage_path,
        7200
      )) || undefined;
    }

    const createdSlides = [];
    const slidesData =
      slides && slides.length > 0 ? slides : [{ slideIndex: 0, title: title || 'Título' }];

    for (let i = 0; i < slidesData.length; i++) {
      const s = slidesData[i];

      // Suporte a upload externo de referência na tela /create
      let refPieceId = s.referencePieceId;
      if (s.referenceType === 'external_upload' && s.referenceImageUrl && !refPieceId) {
        try {
          const uploadResult = await StorageService.uploadBase64({
            bucket: 'client-pieces',
            organizationId: session.organizationId,
            clientId,
            folder: 'pieces',
            originalFilename: s.referenceTitle || 'upload-referencia.png',
            base64Data: s.referenceImageUrl,
          });

          const { data: newPiece } = await (supabase as any)
            .from('client_pieces')
            .insert({
              organization_id: session.organizationId,
              client_id: clientId,
              title: s.referenceTitle || 'Referência Externa',
              original_filename: s.referenceTitle || 'upload-referencia.png',
              storage_bucket: uploadResult.storageBucket,
              storage_path: uploadResult.storagePath,
              file_size_bytes: uploadResult.fileSizeBytes,
              mime_type: uploadResult.mimeType,
              format_type: 'custom',
              piece_type: 'external_reference',
              analysis_status: 'pending',
              created_by: session.userId,
            })
            .select()
            .single();

          if (newPiece) {
            refPieceId = newPiece.id;
          }
        } catch (extUploadErr: any) {
          console.warn('[POST /api/projects] Erro ao salvar referência externa enviada:', extUploadErr?.message);
        }
      }

      const finalRefId = refPieceId || s.referencePieceId || s.baseAssetId || null;

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
        base_asset_id: null,
        status: 'draft',
        metadata: {
          referencePieceId: finalRefId,
          primaryReferencePieceId: s.primaryReferencePieceId || finalRefId,
          referenceType: s.referenceType || (finalRefId ? 'client_piece' : null),
          referenceImageUrl: s.referenceImageUrl || null,
          referenceTitle: s.referenceTitle || null,
        },
      });

      let generatedBg: string | undefined = s.backgroundUrl || undefined;
      let generatedAssetId: string | undefined = undefined;

      try {
        const creativeContext = await contextService.buildContext({
          organizationId: session.organizationId,
          clientId,
          projectId: project.id,
          slideIndex: i,
          formatId: format || 'instagram_feed_4_5',
          content: {
            title: s.title || undefined,
            subtitle: s.subtitle || undefined,
            body: s.body || undefined,
            cta: s.cta || undefined,
            userVisualDirection: s.instructions || globalCreativeDirective || undefined,
          },
          selectedReferenceIds: s.referenceIds || (refPieceId ? [refPieceId] : []),
          primaryReferenceId: s.primaryReferencePieceId || refPieceId || undefined,
        });

        const generatedAsset = await imageGenService.generateSlideVisual({
          context: creativeContext,
          slideId: slideRow.id,
          projectId: project.id,
          profile: body.profile || 'FINAL',
        });
        generatedBg = generatedAsset.publicOrSignedUrl;
        generatedAssetId = generatedAsset.id;
      } catch (err: any) {
        console.warn(`[Slide ${i + 1}] Geração visual:`, err?.message);
      }

      const defaultDoc = await serverCompService.initializeDefaultDocument({
        format: formatDef,
        brandProfile: brandProfile ? (brandProfile as any) : null,
        content: {
          title: s.title,
          subtitle: s.subtitle,
          body: s.body,
          cta: s.cta,
        },
        clientLogoUrl:
          clientLogoSignedUrl ||
          ((logoAsset as any)?.storage_path
            ? `/api/assets/raw?path=${encodeURIComponent((logoAsset as any).storage_path)}`
            : undefined),
        backgroundUrl: generatedBg,
        backgroundAssetId: generatedAssetId,
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
    const safeMsg = err instanceof Error ? (err.stack || err.message) : String(err);
    console.error('[POST /api/projects] Erro inesperado ao criar projeto:', safeMsg);
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
