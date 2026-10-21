// src/app/api/creative-chat/save-production/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess } from '@/lib/auth/server-guards';
import { canCreateProjects } from '@/lib/auth/permissions';
import { isDevStoreAllowed } from '@/config/env';
import { devStore } from '@/lib/dev-store';
import type { ProjectFormat } from '@/types/database';

function normalizeProjectFormat(rawFormat?: string): ProjectFormat {
  if (!rawFormat) return 'instagram_feed_4_5';
  const clean = rawFormat.trim().toLowerCase();
  if (clean === '9:16' || clean.includes('story')) return 'instagram_story';
  if (clean === '1:1' || clean.includes('square') || clean.includes('quadrado')) return 'instagram_square';
  if (clean === '16:9' || clean.includes('custom') || clean.includes('horizontal') || clean.includes('cover')) return 'custom';
  return 'instagram_feed_4_5';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      clientId,
      projectId,
      conversationId,
      messageId,
      imageUrl,
      title,
      format,
      projectType,
      slides,
    } = body;

    if (!clientId || !imageUrl) {
      return NextResponse.json(
        { error: { message: 'clientId e imageUrl são obrigatórios.' } },
        { status: 400 }
      );
    }

    const isCarousel = projectType === 'carousel' || (Array.isArray(slides) && slides.length > 1);
    const resolvedFormat = normalizeProjectFormat(format);
    const resolvedTitle = title || (isCarousel ? 'Carrossel do Chat Criativo' : 'Arte do Chat Criativo');

    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const projId = projectId || `prod-${Date.now()}`;
      const newProd = {
        id: projId,
        organization_id: orgId,
        client_id: clientId,
        name: resolvedTitle,
        title: resolvedTitle,
        project_type: isCarousel ? 'carousel' : 'single_post',
        format: resolvedFormat,
        status: 'approved',
        thumbnail_url: imageUrl,
        conversation_id: conversationId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      devStore.createProject(newProd);

      return NextResponse.json({
        success: true,
        productionId: projId,
        message: isCarousel ? 'Carrossel salvo com sucesso em Produções!' : 'Arte salva com sucesso em Produções!',
      });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (!canCreateProjects(session.role)) {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura e não podem salvar produções.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    let savedProjectId = projectId;

    // Se já tiver projectId, verifica se ele existe no banco
    if (projectId) {
      const { data: existingProject } = await (supabase as any)
        .from('projects')
        .select('id, metadata')
        .eq('id', projectId)
        .eq('organization_id', session.organizationId)
        .maybeSingle();

      if (existingProject) {
        // Atualiza a produção existente para approved com o thumbnail oficial
        await (supabase as any)
          .from('projects')
          .update({
            title: resolvedTitle,
            status: 'approved',
            metadata: {
              ...(existingProject.metadata || {}),
              thumbnail_url: imageUrl,
              savedFromChat: true,
              conversationId,
              messageId,
              savedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        await (supabase as any)
          .from('project_slides')
          .update({
            status: 'approved',
          })
          .eq('project_id', projectId);

        // Atualiza composição do slide 0 com o background
        const { data: firstSlide } = await (supabase as any)
          .from('project_slides')
          .select('id')
          .eq('project_id', projectId)
          .order('slide_index', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstSlide) {
          const { data: existingComp } = await (supabase as any)
            .from('slide_compositions')
            .select('id')
            .eq('slide_id', firstSlide.id)
            .maybeSingle();

          const docLayers = [
            {
              id: `layer-bg-${Date.now()}`,
              name: 'Visual Background',
              type: 'background',
              imageUrl,
              visible: true,
              locked: true,
              opacity: 1,
            },
          ];

          if (existingComp) {
            await (supabase as any)
              .from('slide_compositions')
              .update({
                document: {
                  canvas: { width: 1080, height: 1350, format: resolvedFormat },
                  layers: docLayers,
                  version: 1,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingComp.id);
          } else {
            await (supabase as any)
              .from('slide_compositions')
              .insert({
                organization_id: session.organizationId,
                project_id: projectId,
                slide_id: firstSlide.id,
                document: {
                  canvas: { width: 1080, height: 1350, format: resolvedFormat },
                  layers: docLayers,
                  version: 1,
                },
                revision: 1,
              });
          }
        }

        return NextResponse.json({
          success: true,
          productionId: projectId,
          message: 'Arte salva e confirmada com sucesso em Produções!',
        });
      }
    }

    // Caso não exista, cria o novo projeto (produção)
    const { data: project, error: projErr } = await (supabase as any)
      .from('projects')
      .insert({
        organization_id: session.organizationId,
        client_id: clientId,
        title: resolvedTitle,
        project_type: isCarousel ? 'carousel' : 'single_post',
        format: resolvedFormat,
        status: 'approved',
        metadata: {
          thumbnail_url: imageUrl,
          savedFromChat: true,
          conversationId,
          messageId,
          savedAt: new Date().toISOString(),
        },
        created_by: session.userId,
      })
      .select()
      .single();

    if (projErr) {
      console.error('[POST /api/creative-chat/save-production] Erro ao criar projeto:', projErr);
      throw projErr;
    }

    savedProjectId = project.id;

    // Cria os slides
    if (isCarousel && Array.isArray(slides) && slides.length > 0) {
      for (let idx = 0; idx < slides.length; idx++) {
        const sl = slides[idx];
        const { data: createdSlide } = await (supabase as any)
          .from('project_slides')
          .insert({
            organization_id: session.organizationId,
            project_id: project.id,
            slide_index: idx,
            slide_type: idx === 0 ? 'cover' : idx === slides.length - 1 ? 'cta' : 'content',
            title: sl.title || `Lâmina ${idx + 1}`,
            status: 'approved',
            metadata: {
              chatGenerated: true,
              thumbnail_url: sl.imageUrl || imageUrl,
              conversationId,
              messageId,
              savedAt: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (createdSlide) {
          await (supabase as any)
            .from('slide_compositions')
            .insert({
              organization_id: session.organizationId,
              project_id: project.id,
              slide_id: createdSlide.id,
              document: {
                canvas: { width: 1080, height: 1350, format: resolvedFormat },
                layers: [
                  {
                    id: `layer-bg-${idx}`,
                    name: 'Visual Background',
                    type: 'background',
                    imageUrl: sl.imageUrl || imageUrl,
                    visible: true,
                    locked: true,
                    opacity: 1,
                  },
                ],
                version: 1,
              },
              revision: 1,
            });
        }
      }
    } else {
      const { data: createdSlide } = await (supabase as any)
        .from('project_slides')
        .insert({
          organization_id: session.organizationId,
          project_id: project.id,
          slide_index: 0,
          slide_type: 'cover',
          status: 'approved',
          metadata: {
            chatGenerated: true,
            thumbnail_url: imageUrl,
            conversationId,
            messageId,
            savedAt: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (createdSlide) {
        await (supabase as any)
          .from('slide_compositions')
          .insert({
            organization_id: session.organizationId,
            project_id: project.id,
            slide_id: createdSlide.id,
            document: {
              canvas: { width: 1080, height: 1350, format: resolvedFormat },
              layers: [
                {
                  id: `layer-bg-0`,
                  name: 'Visual Background',
                  type: 'background',
                  imageUrl,
                  visible: true,
                  locked: true,
                  opacity: 1,
                },
              ],
              version: 1,
            },
            revision: 1,
          });
      }
    }

    return NextResponse.json({
      success: true,
      productionId: savedProjectId,
      message: isCarousel ? 'Carrossel salvo com sucesso em Produções!' : 'Arte salva com sucesso em Produções!',
    });
  } catch (err: any) {
    console.error('[POST /api/creative-chat/save-production] Falha:', err);
    return NextResponse.json(
      { error: { message: err?.message || 'Erro ao salvar arte em Produções.' } },
      { status: 500 }
    );
  }
}
