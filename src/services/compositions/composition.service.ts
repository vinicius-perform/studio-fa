// src/services/compositions/composition.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { SlideDocument, SlideCompositionRow, Layer } from '@/types/domain/composition';
import type { BrandProfile } from '@/types/domain/brand';
import type { FormatDefinition } from '@/config/formats';
import { getFormatDefinition } from '@/config/formats';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class CompositionService {
  constructor(private readonly supabase: SupabaseClient<any, any, any>) {}

  async getBySlideId(slideId: string, organizationId: string): Promise<SlideCompositionRow | null> {
    const { data, error } = await this.supabase
      .from('slide_compositions')
      .select('*')
      .eq('slide_id', slideId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      Logger.error({ operation: 'get_slide_composition', organizationId, result: 'error' }, error);
      throw error;
    }

    return data;
  }

  async saveComposition(params: {
    slideId: string;
    projectId: string;
    organizationId: string;
    document: SlideDocument;
    expectedRevision: number;
    userId: string;
    previewAssetId?: string;
  }): Promise<SlideCompositionRow> {
    // 1. Fetch current row to verify optimistic concurrency
    const existing = await this.getBySlideId(params.slideId, params.organizationId);

    if (existing) {
      const isDifferentUser = existing.updated_by && existing.updated_by !== params.userId;
      if (isDifferentUser && existing.revision !== params.expectedRevision) {
        throw new ConflictError(
          `Esta lâmina foi atualizada em outra sessão (revisão no servidor: ${existing.revision}, sua revisão: ${params.expectedRevision}). Recarregue para mesclar as alterações.`
        );
      }

      const nextRevision = Math.max(existing.revision, params.expectedRevision || 1) + 1;

      const { data, error } = await this.supabase
        .from('slide_compositions')
        .update({
          document: params.document as any,
          revision: nextRevision,
          preview_asset_id: params.previewAssetId || existing.preview_asset_id,
          updated_by: params.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('slide_id', params.slideId)
        .eq('organization_id', params.organizationId)
        .select()
        .single();

      if (error || !data) {
        throw new ValidationError(`Erro ao salvar composição: ${error?.message}`);
      }

      return data;
    }

    // Insert new
    const { data, error } = await this.supabase
      .from('slide_compositions')
      .insert({
        organization_id: params.organizationId,
        project_id: params.projectId,
        slide_id: params.slideId,
        document: params.document as any,
        revision: 1,
        preview_asset_id: params.previewAssetId ?? null,
        created_by: params.userId,
        updated_by: params.userId,
      })
      .select()
      .single();

    if (error || !data) {
      throw new ValidationError(`Erro ao criar composição inicial: ${error?.message}`);
    }

    return data;
  }

  /**
   * Initializes a default multi-layer editable document for a slide.
   */
  async initializeDefaultDocument(params: {
    format: FormatDefinition;
    brandProfile?: BrandProfile | null;
    content: {
      title?: string;
      subtitle?: string;
      body?: string;
      cta?: string;
    };
    clientLogoUrl?: string;
    backgroundUrl?: string;
    backgroundAssetId?: string;
  }): Promise<SlideDocument> {
    const { format, brandProfile, content, clientLogoUrl, backgroundUrl, backgroundAssetId } = params;

    const layers: Layer[] = [];
    const w = format.exportWidth;
    const h = format.exportHeight;

    const primaryColor = brandProfile?.colors.primary[0] || '#0B0F17';
    const accentColor = brandProfile?.colors.accent[0] || '#CEF52A';
    const textColor = brandProfile?.colors.text[0] || '#FFFFFF';
    const headingFont = brandProfile?.typography.detectedFonts?.[0] || 'Inter, sans-serif';

    // 1. Background layer
    if (backgroundUrl) {
      layers.push({
        id: 'layer-bg',
        name: 'Background IA',
        type: 'image',
        imageUrl: backgroundUrl,
        assetId: backgroundAssetId,
        fit: 'cover',
        x: 0,
        y: 0,
        width: w,
        height: h,
        zIndex: 0,
        visible: true,
        locked: false,
      });
    } else {
      layers.push({
        id: 'layer-bg-solid',
        name: 'Fundo Base',
        type: 'shape',
        shapeType: 'rectangle',
        fillColor: primaryColor,
        x: 0,
        y: 0,
        width: w,
        height: h,
        zIndex: 0,
        visible: true,
        locked: false,
      });
    }

    // 2. Subtle overlay for text legibility
    layers.push({
      id: 'layer-overlay',
      name: 'Overlay de Legibilidade',
      type: 'overlay',
      overlayType: 'gradient_top',
      color: '#07090E',
      opacity: 0.45,
      x: 0,
      y: 0,
      width: w,
      height: h,
      zIndex: 1,
      visible: true,
      locked: false,
    });

    // 3. Client Logo Layer (official asset, non-stretched)
    if (clientLogoUrl) {
      layers.push({
        id: 'layer-logo',
        name: 'Logo Oficial',
        type: 'logo',
        logoUrl: clientLogoUrl,
        x: format.safeArea.left,
        y: format.safeArea.top,
        width: 180,
        height: 60,
        aspectRatio: 3,
        zIndex: 10,
        visible: true,
        locked: false,
      });
    }

    // 4. Headline / Title
    if (content.title) {
      layers.push({
        id: 'layer-title',
        name: 'Título Principal',
        type: 'text',
        semanticRole: 'title',
        text: content.title,
        fontFamily: headingFont,
        fontSize: Math.round(w * 0.058), // ~62px for 1080
        fontWeight: 'bold',
        color: textColor,
        align: 'left',
        x: format.safeArea.left,
        y: Math.round(h * 0.28),
        width: Math.round(w * 0.8),
        height: 220,
        lineHeight: 1.15,
        zIndex: 20,
        visible: true,
        locked: false,
      });
    }

    // 5. Subtitle / Body
    if (content.subtitle || content.body) {
      layers.push({
        id: 'layer-subtitle',
        name: 'Subtítulo / Conteúdo',
        type: 'text',
        semanticRole: 'subtitle',
        text: content.subtitle || content.body || '',
        fontFamily: headingFont,
        fontSize: Math.round(w * 0.032), // ~34px for 1080
        fontWeight: 'normal',
        color: '#D1D5DB',
        align: 'left',
        x: format.safeArea.left,
        y: Math.round(h * 0.58),
        width: Math.round(w * 0.75),
        height: 180,
        lineHeight: 1.4,
        zIndex: 21,
        visible: true,
        locked: false,
      });
    }

    // 6. CTA / Button
    if (content.cta) {
      // Button background shape
      const btnW = 320;
      const btnH = 64;
      const btnX = format.safeArea.left;
      const btnY = h - format.safeArea.bottom - btnH - 20;

      layers.push({
        id: 'layer-cta-bg',
        name: 'Botão CTA',
        type: 'shape',
        shapeType: 'rectangle',
        fillColor: accentColor,
        cornerRadius: 12,
        x: btnX,
        y: btnY,
        width: btnW,
        height: btnH,
        zIndex: 25,
        visible: true,
        locked: false,
      });

      layers.push({
        id: 'layer-cta-text',
        name: 'Texto do CTA',
        type: 'text',
        semanticRole: 'cta',
        text: content.cta,
        fontFamily: headingFont,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0B0F17',
        align: 'center',
        x: btnX,
        y: btnY + 18,
        width: btnW,
        height: 30,
        zIndex: 26,
        visible: true,
        locked: false,
      });
    }

    return {
      version: 1,
      canvas: {
        width: w,
        height: h,
        format: format.id,
        backgroundColor: primaryColor,
      },
      layers,
    };
  }

  /**
   * Atualiza exclusivamente o background visual gerado por IA,
   * preservando rigorosamente todas as demais layers (títulos, logo, textos, CTA e posições).
   */
  public updateBackgroundLayer(
    document: SlideDocument,
    newBackgroundUrl: string,
    newAssetId?: string
  ): SlideDocument {
    const updatedLayers = document.layers.map((layer) => {
      if (layer.id === 'layer-bg' && layer.type === 'image') {
        return {
          ...layer,
          imageUrl: newBackgroundUrl,
          assetId: newAssetId || layer.assetId,
          fit: 'cover' as const,
        };
      }
      return layer;
    });

    const hasBgLayer = updatedLayers.some((l) => l.id === 'layer-bg');
    if (!hasBgLayer) {
      updatedLayers.unshift({
        id: 'layer-bg',
        name: 'Background IA',
        type: 'image',
        imageUrl: newBackgroundUrl,
        assetId: newAssetId,
        fit: 'cover',
        x: 0,
        y: 0,
        width: document.canvas.width,
        height: document.canvas.height,
        zIndex: 0,
        visible: true,
        locked: false,
      });
    }

    return {
      ...document,
      layers: updatedLayers,
    };
  }
}

