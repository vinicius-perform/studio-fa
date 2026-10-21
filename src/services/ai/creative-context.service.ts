// src/services/ai/creative-context.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getFormatDefinition, type FormatId } from '@/config/formats';
import type { BrandDNA } from '@/types/domain/dna';
import type { PieceAnalysis } from '@/types/domain/piece';
import {
  type CreativeContext,
  type CompactBrandContext,
  type SelectedReferencePiece,
  CreativeContextSchema,
  GPT_IMAGE_RESOLUTIONS,
} from '@/types/domain/creative-engine';
import { Logger } from '@/lib/logger';
import { isDevStoreAllowed } from '@/config/env';
import { devStore } from '@/lib/dev-store';

export interface BuildCreativeContextInput {
  organizationId: string;
  clientId: string;
  projectId: string;
  slideIndex: number;
  formatId: string;
  content: {
    title?: string;
    subtitle?: string;
    body?: string;
    cta?: string;
    userVisualDirection?: string;
  };
  selectedReferenceIds?: string[];
  primaryReferenceId?: string;
}

export class CreativeContextService {
  constructor(private readonly supabase: SupabaseClient<any, any, any>) {}

  /**
   * Compila o BrandPromptContext determinístico e compacto localmente,
   * sem gastar nenhuma chamada ou token de IA.
   */
  public static buildCompactBrandContext(
    dna: BrandDNA | null,
    manualGuidelines?: string | null,
    brandColors?: { primary?: string; secondary?: string; accent?: string }
  ): CompactBrandContext {
    const manualRulesList: string[] = [];
    if (manualGuidelines && manualGuidelines.trim()) {
      manualRulesList.push(
        ...manualGuidelines
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
      );
    }

    if (!dna) {
      // Fallback determinístico caso o cliente ainda não tenha DNA compilado
      const primary = brandColors?.primary ? [brandColors.primary] : ['#0B0F17'];
      const secondary = brandColors?.secondary ? [brandColors.secondary] : ['#1E2630'];
      const accent = brandColors?.accent ? [brandColors.accent] : ['#CEF52A'];

      return {
        mood: ['Contemporâneo', 'Sofisticado', 'Profissional'],
        palette: {
          primary,
          secondary,
          accent,
          background: ['#0A0A0A', '#111827'],
        },
        typographyCharacter: 'Tipografia institucional limpa com alto contraste',
        imagery: {
          imageType: 'Composição de estúdio com iluminação suave',
          treatment: 'Tons equilibrados, acabamento limpo e natural',
          lighting: 'Luz direcional suave com foco equilibrado',
        },
        composition: {
          layoutDensity: 'Moderada com respiro intencional',
          negativeSpacePreference: 'Espaço negativo reservado para tipografia externa',
        },
        doRules: [
          'Preservar legibilidade absoluta',
          'Utilizar as cores oficiais da marca',
          'Reservar safe zone para títulos e logo',
        ],
        dontRules: [
          'Nunca renderizar texto ou logos dentro da imagem gerada',
          'Evitar artefatos plásticos ou composições poluídas',
        ],
        logoBehavior: 'Logo oficial mantido em layer externa pelo estúdio',
        manualRules: manualRulesList,
      };
    }

    // Extrai do BrandDNA com prioridade máxima para diretrizes manuais
    const primColors = (dna as any).colorSystem?.primary ? [(dna as any).colorSystem.primary] : [];
    if (brandColors?.primary && !primColors.includes(brandColors.primary)) {
      primColors.unshift(brandColors.primary);
    }

    const secColors = (dna as any).colorSystem?.secondary ? [(dna as any).colorSystem.secondary] : [];
    if (brandColors?.secondary && !secColors.includes(brandColors.secondary)) {
      secColors.unshift(brandColors.secondary);
    }

    const accColors = (dna as any).colorSystem?.accent ? [(dna as any).colorSystem.accent] : [];
    if (brandColors?.accent && !accColors.includes(brandColors.accent)) {
      accColors.unshift(brandColors.accent);
    }

    const bgColors = (dna as any).colorSystem?.neutrals?.length ? (dna as any).colorSystem.neutrals : ['#0A0A0A'];

    const moodList = (dna as any).toneAndVoice
      ? [(dna as any).toneAndVoice]
      : ['Elegante', 'Corporativo'];

    const doRules = [
      ...((dna as any).do || []),
      'Preservar legibilidade absoluta',
    ].slice(0, 5);

    const dontRules = [
      ...((dna as any).dont || []),
      'NUNCA renderizar tipografia, texto, números ou logos dentro da arte visual gerada',
    ].slice(0, 5);

    return {
      mood: moodList,
      palette: {
        primary: primColors.length > 0 ? primColors : ['#0B0F17'],
        secondary: secColors.length > 0 ? secColors : ['#1E2630'],
        accent: accColors.length > 0 ? accColors : ['#CEF52A'],
        background: bgColors,
      },
      typographyCharacter: `${(dna as any).typography?.titleFont || 'Inter'} — ${(dna as any).typography?.hierarchyGuidelines || 'Hierarquia dominante'}`,
      imagery: {
        imageType: (dna as any).imagery?.photoStyle || 'Fotografia editorial moderna',
        treatment: (dna as any).imagery?.subjectTreatment || 'Tons naturais e texturas refinadas',
        lighting: (dna as any).imagery?.lightingPreference || 'Luz natural de estúdio suave',
      },
      composition: {
        layoutDensity: (dna as any).composition?.visualDensity || 'Equilibrada',
        negativeSpacePreference: (dna as any).composition?.whiteSpaceRule || 'Amplo espaço negativo lateral',
      },
      doRules,
      dontRules,
      logoBehavior: (dna as any).logoRules?.preferredPlacement || 'Logo oficial reservado na safe zone do canvas',
      manualRules: manualRulesList,
    };
  }

  /**
   * Constrói o CreativeContext completo para uma lâmina de projeto
   */
  public async buildContext(input: BuildCreativeContextInput): Promise<CreativeContext> {
    Logger.info({
      operation: 'build_creative_context',
      result: 'started',
      organizationId: input.organizationId,
      metadata: { clientId: input.clientId, slideIndex: input.slideIndex },
    });

    // 1. Busca dados do cliente e DNA
    const { data: client, error: clientErr } = await this.supabase
      .from('clients')
      .select('id, name, niche, manual_guidelines, dna')
      .eq('id', input.clientId)
      .eq('organization_id', input.organizationId)
      .single();

    if (clientErr || !client) {
      throw new Error(`Cliente não encontrado para a organização informada: ${clientErr?.message}`);
    }

    // 2. Busca versão mais recente do Brand DNA na tabela versionada
    const { data: dnaVersionRow } = await this.supabase
      .from('brand_dna_versions')
      .select('id, version_number')
      .eq('client_id', input.clientId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Busca logo oficial e ativos de marca
    const { data: logoAsset } = await this.supabase
      .from('client_assets')
      .select('storage_path, storage_bucket')
      .eq('client_id', input.clientId)
      .in('asset_type', ['logo_primary', 'logo_monochrome'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Busca referências visuais selecionadas (preservando todas as referências ativas da seleção)
    const selectedRefs: SelectedReferencePiece[] = [];
    const refIds = input.selectedReferenceIds || [];

    if (refIds.length > 0) {
      let pieces: any[] = [];
      if (isDevStoreAllowed()) {
        const devRefs = devStore.listBrandReferences(input.clientId);
        pieces = devRefs
          .filter((r: any) => refIds.includes(r.id))
          .map((r: any) => ({
            id: r.id,
            title: r.title,
            storage_bucket: r.storage_bucket || 'brand-references',
            storage_path: r.storage_path,
            analysis_json: r.analysis_json,
          }));
      } else {
        const { data } = await this.supabase
          .from('client_pieces')
          .select('id, title, storage_bucket, storage_path, analysis_json')
          .eq('client_id', input.clientId)
          .eq('organization_id', input.organizationId)
          .in('id', refIds);
        pieces = data || [];
      }

      if (pieces && pieces.length > 0) {
        // Ordena para que a referência primária venha primeiro
        const sorted = [...pieces].sort((a, b) => {
          if (input.primaryReferenceId) {
            if (a.id === input.primaryReferenceId) return -1;
            if (b.id === input.primaryReferenceId) return 1;
          }
          return refIds.indexOf(a.id) - refIds.indexOf(b.id);
        });

        for (const p of sorted) {
          const isPrimary = input.primaryReferenceId
            ? p.id === input.primaryReferenceId
            : selectedRefs.length === 0;

          selectedRefs.push({
            pieceId: p.id,
            title: p.title || undefined,
            storageBucket: p.storage_bucket,
            storagePath: p.storage_path,
            isPrimary,
            analysis: p.analysis_json as PieceAnalysis | null,
          });
        }
      }
    }

    // 5. Normaliza formato e dimensões
    const formatDef = getFormatDefinition((input.formatId as FormatId) || 'instagram_feed_4_5');
    const gptRes = GPT_IMAGE_RESOLUTIONS[formatDef.aspectRatio] || {
      aspectRatio: formatDef.aspectRatio,
      generationWidth: formatDef.generationWidth,
      generationHeight: formatDef.generationHeight,
      canvasWidth: formatDef.exportWidth,
      canvasHeight: formatDef.exportHeight,
    };

    // 6. Constrói BrandPromptContext compacto
    const clientDna = (client.dna as BrandDNA | null) || null;
    const compactBrandContext = CreativeContextService.buildCompactBrandContext(
      clientDna,
      client.manual_guidelines
    );

    const manualRules = compactBrandContext.manualRules;

    const rawContext = {
      organizationId: input.organizationId,
      clientId: client.id,
      clientName: client.name,
      clientNiche: client.niche,
      format: {
        id: formatDef.id,
        name: formatDef.name,
        aspectRatio: gptRes.aspectRatio,
        generationWidth: gptRes.generationWidth,
        generationHeight: gptRes.generationHeight,
        exportWidth: gptRes.canvasWidth,
        exportHeight: gptRes.canvasHeight,
      },
      exactContent: {
        title: input.content.title,
        subtitle: input.content.subtitle,
        body: input.content.body,
        cta: input.content.cta,
        userVisualDirection: input.content.userVisualDirection,
      },
      manualRules,
      compactBrandContext,
      currentDnaVersionId: dnaVersionRow?.id || null,
      brandAssets: {
        logoUrl: logoAsset?.storage_path,
        primaryColor: compactBrandContext.palette.primary[0],
        secondaryColor: compactBrandContext.palette.secondary[0],
        accentColor: compactBrandContext.palette.accent[0],
      },
      selectedReferences: selectedRefs,
    };

    return CreativeContextSchema.parse(rawContext);
  }
}
