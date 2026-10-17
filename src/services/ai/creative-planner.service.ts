// src/services/ai/creative-planner.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BrandProfile } from '@/types/domain/brand';
import type { FormatDefinition } from '@/config/formats';
import {
  type ProjectCreativePlan,
  type SlidePlan,
  type GlobalCreativeDirection,
  type ProjectCreativePlanRow,
} from '@/types/domain/creative-plan';
import { Logger } from '@/lib/logger';
import { ValidationError } from '@/lib/errors';

export interface PlanGenerationInput {
  organizationId: string;
  projectId: string;
  clientId: string;
  brandProfile: BrandProfile;
  brandProfileId?: string;
  format: FormatDefinition;
  projectType: 'single_post' | 'carousel';
  globalCreativeDirective?: string;
  slides: {
    id?: string;
    slideIndex: number;
    title?: string;
    subtitle?: string;
    body?: string;
    cta?: string;
    instructions?: string;
    baseAssetId?: string;
    baseImageStrategy?: 'preserve_photo' | 'edit_photo_ai' | 'generate_new_image';
  }[];
  userId: string;
}

export class CreativePlannerService {
  constructor(private readonly supabase: SupabaseClient<any, any, any>) {}

  /**
   * Plans the creative direction and layout for single post or multi-slide carousel.
   */
  async generatePlan(input: PlanGenerationInput): Promise<{
    plan: ProjectCreativePlan;
    savedRow: ProjectCreativePlanRow;
  }> {
    Logger.info({
      operation: 'generate_creative_plan',
      organizationId: input.organizationId,
      result: 'started',
      metadata: { projectId: input.projectId, slideCount: input.slides.length },
    });

    // 1. Fetch relevant brand references using semantic search or approved pool
    const selectedReferenceIds: string[] = [];
    try {
      const { data: refs } = await this.supabase
        .from('brand_references')
        .select('id, title, description, tags')
        .eq('organization_id', input.organizationId)
        .eq('client_id', input.clientId)
        .eq('is_approved', true)
        .limit(4);

      if (refs && refs.length > 0) {
        selectedReferenceIds.push(...refs.map((r) => r.id));
      }
    } catch (err) {
      Logger.error({ operation: 'fetch_references_for_plan', result: 'error' }, err);
    }

    // 2. Formulate Global Creative Direction
    const globalDirection: GlobalCreativeDirection = {
      concept: input.globalCreativeDirective || `${input.brandProfile.summary} - Direção editorial equilibrada`,
      visualRhythm: input.projectType === 'carousel'
        ? 'Alternância ritmada entre lâminas de impacto com foto e lâminas de leitura limpa'
        : 'Composição de impacto direto e leitura rápida',
      backgroundStyle: `Ambiente contemporâneo com paleta base (${input.brandProfile.colors.background.join(', ') || '#0B0F17'}) e acentos pontuais`,
      photographyStyle: input.brandProfile.photography.style || 'Retratos corporativos com luz suave direcional',
      graphicLanguage: input.brandProfile.graphicalElements.patterns || ['Bordas arredondadas', 'Linhas sutis', 'Respiros amplos'],
      consistencyRules: [
        'Mesma hierarquia tipográfica em todo o projeto',
        'Posicionamento consistente do logo institucional',
        'Contraste nítido para legibilidade móvel',
      ],
    };

    // 3. Formulate per-slide plans
    const slidePlans: SlidePlan[] = input.slides.map((s, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === input.slides.length - 1 && input.slides.length > 1;

      const slideType = isFirst
        ? 'cover'
        : isLast && s.cta
        ? 'cta'
        : idx % 2 === 1
        ? 'problem'
        : 'solution';

      // Decide layout coordinates based on slide type and content
      let layout: SlidePlan['layout'];
      let negativeSpaceDesc: string;

      if (slideType === 'cover') {
        layout = {
          title: { x: 0.08, y: 0.25, width: 0.75, align: 'left' },
          subtitle: { x: 0.08, y: 0.65, width: 0.65, align: 'left' },
          logo: { x: 0.08, y: 0.08, width: 0.25, align: 'left' },
        };
        negativeSpaceDesc = 'Foco visual no terço direito inferior; espaço negativo limpo no canto superior e esquerdo para o título.';
      } else if (slideType === 'cta') {
        layout = {
          title: { x: 0.1, y: 0.35, width: 0.8, align: 'center' },
          subtitle: { x: 0.15, y: 0.55, width: 0.7, align: 'center' },
          cta: { x: 0.25, y: 0.75, width: 0.5, align: 'center' },
          logo: { x: 0.35, y: 0.15, width: 0.3, align: 'center' },
        };
        negativeSpaceDesc = 'Fundo sutil e harmonioso com foco central para direcionamento da ação (CTA).';
      } else {
        layout = {
          title: { x: 0.08, y: 0.18, width: 0.65, align: 'left' },
          body: { x: 0.08, y: 0.45, width: 0.6, align: 'left' },
          logo: { x: 0.08, y: 0.08, width: 0.2, align: 'left' },
        };
        negativeSpaceDesc = 'Fundo com elementos fotográficos à direita e ampla área de respiro na metade esquerda.';
      }

      const visualConcept = s.instructions || `Lâmina ${s.slideIndex + 1} (${slideType}) destacando a identidade de marca com elegância visual.`;

      const imagePrompt = `Visual de estúdio moderno, iluminação suave, textura refinada. Tema: ${s.title || visualConcept}.`;

      return {
        slideIndex: s.slideIndex,
        slideType,
        visualConcept,
        imageStrategy: s.baseImageStrategy || (s.baseAssetId ? 'preserve_photo' : 'generate_new_image'),
        imagePrompt,
        negativeSpace: negativeSpaceDesc,
        layout,
        textHierarchy: isFirst ? 'H1 Dominante em negrito' : 'H2 com corpo legível',
        palette: input.brandProfile.colors.primary,
        logoPlacement: isFirst ? 'top-left' : 'top-left',
        graphicElements: input.brandProfile.graphicalElements.shapes || [],
        referenceIds: selectedReferenceIds.slice(0, 2),
      };
    });

    const fullPlan: ProjectCreativePlan = {
      globalDirection,
      slidePlans,
      selectedReferenceIds,
    };

    // 4. Persist in database
    const { data: savedRow, error: saveErr } = await this.supabase
      .from('project_creative_plans')
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        version: 1,
        brand_profile_id: input.brandProfileId ?? null,
        status: 'ready',
        global_direction: fullPlan.globalDirection as any,
        slide_plans: fullPlan.slidePlans as any,
        selected_reference_ids: fullPlan.selectedReferenceIds as any,
        provider: 'openai',
        model: 'gpt-4o',
        created_by: input.userId,
      })
      .select()
      .single();

    if (saveErr || !savedRow) {
      Logger.error({ operation: 'save_creative_plan', result: 'error' }, saveErr);
      throw new ValidationError(`Erro ao salvar plano criativo: ${saveErr?.message}`);
    }

    Logger.info({
      operation: 'generate_creative_plan',
      organizationId: input.organizationId,
      result: 'success',
      metadata: { planId: savedRow.id },
    });

    return { plan: fullPlan, savedRow };
  }

  async getLatestPlan(projectId: string, organizationId: string): Promise<ProjectCreativePlanRow | null> {
    const { data, error } = await this.supabase
      .from('project_creative_plans')
      .select('*')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }
}
