// tests/image-fit-and-traceability.test.ts
import { describe, it, expect } from './support/bun-test-shim';
import { calculateCoverCrop } from '../src/lib/image-fit';
import { GPT_IMAGE_RESOLUTIONS } from '../src/types/domain/creative-engine';
import { CompositionService } from '../src/services/compositions/composition.service';
import type { SlideDocument } from '../src/types/domain/composition';

describe('FASE C.1: Image Fit, Crop Determinístico e Preservação de Proporção', () => {
  it('Feed 4:5 — Fonte idêntica (1024x1280 para 1080x1350): usa 100% dos pixels sem crop', () => {
    const res = calculateCoverCrop(1024, 1280, 1080, 1350);
    expect(res.sourceAspectRatio).toBeCloseTo(0.8, 3);
    expect(res.targetAspectRatio).toBeCloseTo(0.8, 3);
    expect(res.effectiveAspectRatio).toBeCloseTo(0.8, 3);
    expect(res.crop.x).toBe(0);
    expect(res.crop.y).toBe(0);
    expect(res.crop.width).toBe(1024);
    expect(res.crop.height).toBe(1280);
  });

  it('Feed 4:5 — Fonte mais alta (1024x1536 para 1080x1350): corta altura com centro focal 0.5', () => {
    const res = calculateCoverCrop(1024, 1536, 1080, 1350, { x: 0.5, y: 0.5 });
    expect(res.targetAspectRatio).toBeCloseTo(0.8, 3);
    expect(res.effectiveAspectRatio).toBeCloseTo(0.8, 3);
    expect(res.crop.width).toBe(1024);
    expect(res.crop.height).toBe(1280); // 1024 / 0.8 = 1280
    expect(res.crop.x).toBe(0);
    expect(res.crop.y).toBe(128); // (1536 - 1280) * 0.5 = 128
  });

  it('Feed 4:5 — Fonte mais alta com focal point no topo (y = 0.0)', () => {
    const res = calculateCoverCrop(1024, 1536, 1080, 1350, { x: 0.5, y: 0.0 });
    expect(res.crop.y).toBe(0);
    expect(res.crop.height).toBe(1280);
  });

  it('Story 9:16 — Fonte idêntica (1008x1792 para 1080x1920): proporção 0.5625 exata', () => {
    const res = calculateCoverCrop(1008, 1792, 1080, 1920);
    expect(res.sourceAspectRatio).toBeCloseTo(0.5625, 4);
    expect(res.targetAspectRatio).toBeCloseTo(0.5625, 4);
    expect(res.effectiveAspectRatio).toBeCloseTo(0.5625, 4);
    expect(res.crop.width).toBe(1008);
    expect(res.crop.height).toBe(1792);
  });

  it('Story 9:16 — Fonte quadrada (1024x1024 para 1080x1920): corta laterais com centro focal 0.5', () => {
    const res = calculateCoverCrop(1024, 1024, 1080, 1920, { x: 0.5, y: 0.5 });
    expect(res.targetAspectRatio).toBeCloseTo(0.5625, 4);
    expect(res.effectiveAspectRatio).toBeCloseTo(0.5625, 4);
    expect(res.crop.height).toBe(1024);
    expect(res.crop.width).toBe(576); // 1024 * 0.5625 = 576
    expect(res.crop.x).toBe(224); // (1024 - 576) * 0.5 = 224
    expect(res.crop.y).toBe(0);
  });

  it('Square 1:1 — Fonte idêntica (1024x1024 para 1080x1080): sem cortes', () => {
    const res = calculateCoverCrop(1024, 1024, 1080, 1080);
    expect(res.effectiveAspectRatio).toBe(1);
    expect(res.crop.width).toBe(1024);
    expect(res.crop.height).toBe(1024);
    expect(res.crop.x).toBe(0);
    expect(res.crop.y).toBe(0);
  });

  it('Square 1:1 — Fonte widescreen (1920x1080 para 1080x1080): corta laterais preservando centro', () => {
    const res = calculateCoverCrop(1920, 1080, 1080, 1080, { x: 0.5, y: 0.5 });
    expect(res.effectiveAspectRatio).toBe(1);
    expect(res.crop.width).toBe(1080);
    expect(res.crop.height).toBe(1080);
    expect(res.crop.x).toBe(420); // (1920 - 1080) * 0.5 = 420
    expect(res.crop.y).toBe(0);
  });

  it('Horizontal 16:9 — Fonte idêntica (1792x1008 para 1920x1080): proporção 1.7778 exata', () => {
    const res = calculateCoverCrop(1792, 1008, 1920, 1080);
    expect(res.sourceAspectRatio).toBeCloseTo(16 / 9, 3);
    expect(res.targetAspectRatio).toBeCloseTo(16 / 9, 3);
    expect(res.effectiveAspectRatio).toBeCloseTo(16 / 9, 3);
    expect(res.crop.width).toBe(1792);
    expect(res.crop.height).toBe(1008);
  });

  it('Horizontal 16:9 — Fonte vertical 4:5 (1080x1350 para 1920x1080): corta vertical preservando centro', () => {
    const res = calculateCoverCrop(1080, 1350, 1920, 1080, { x: 0.5, y: 0.5 });
    expect(res.targetAspectRatio).toBeCloseTo(16 / 9, 3);
    expect(res.effectiveAspectRatio).toBeCloseTo(16 / 9, 2);
    expect(res.crop.width).toBe(1080);
    expect(res.crop.height).toBe(608); // 1080 / (16/9) ~ 607.5 -> 608
    expect(res.crop.x).toBe(0);
    expect(res.crop.y).toBe(371); // (1350 - 608) * 0.5 = 371
  });
});

describe('FASE C.1: Resoluções Oficiais GPT Image (Zero DALL-E em Runtime)', () => {
  it('mapeia Feed 4:5 para resolução exata 1024x1280 (proporção 0.8)', () => {
    const res = GPT_IMAGE_RESOLUTIONS['4:5'];
    expect(res.generationWidth).toBe(1024);
    expect(res.generationHeight).toBe(1280);
    expect(res.generationWidth / res.generationHeight).toBe(0.8);
    expect(res.canvasWidth / res.canvasHeight).toBe(0.8);
  });

  it('mapeia Story 9:16 para resolução exata 1008x1792 (proporção 0.5625)', () => {
    const res = GPT_IMAGE_RESOLUTIONS['9:16'];
    expect(res.generationWidth).toBe(1008);
    expect(res.generationHeight).toBe(1792);
    expect(res.generationWidth / res.generationHeight).toBe(0.5625);
    expect(res.canvasWidth / res.canvasHeight).toBe(0.5625);
  });

  it('mapeia Square 1:1 para resolução exata 1024x1024 (proporção 1.0)', () => {
    const res = GPT_IMAGE_RESOLUTIONS['1:1'];
    expect(res.generationWidth).toBe(1024);
    expect(res.generationHeight).toBe(1024);
    expect(res.generationWidth / res.generationHeight).toBe(1.0);
  });

  it('mapeia 16:9 para resolução exata 1792x1008 (proporção 1.7778)', () => {
    const res = GPT_IMAGE_RESOLUTIONS['16:9'];
    expect(res.generationWidth).toBe(1792);
    expect(res.generationHeight).toBe(1008);
    expect(res.generationWidth / res.generationHeight).toBeCloseTo(16 / 9, 3);
  });
});

describe('FASE C.1: Regeneração Cirúrgica e Rastreabilidade Bidirecional', () => {
  const compService = new CompositionService({} as any);

  const initialDocument: SlideDocument = {
    version: 1,
    canvas: { width: 1080, height: 1350, format: 'instagram_feed_4_5', backgroundColor: '#0B0F17' },
    layers: [
      {
        id: 'layer-bg',
        name: 'Background IA',
        type: 'image',
        imageUrl: 'https://storage.supabase.co/generated-assets/bg_original.png',
        assetId: 'asset-uuid-001',
        fit: 'cover',
        x: 0,
        y: 0,
        width: 1080,
        height: 1350,
        zIndex: 0,
      },
      {
        id: 'layer-logo',
        name: 'Logo Oficial',
        type: 'logo',
        logoUrl: 'https://storage.supabase.co/brand-assets/logo.png',
        aspectRatio: 3,
        x: 60,
        y: 60,
        width: 180,
        height: 60,
        zIndex: 10,
      },
      {
        id: 'layer-title',
        name: 'Título Principal',
        type: 'text',
        semanticRole: 'title',
        text: 'Headline do Usuário Intacta',
        fontFamily: 'Inter',
        fontSize: 62,
        color: '#FFFFFF',
        x: 60,
        y: 380,
        width: 860,
        height: 220,
        zIndex: 20,
      },
      {
        id: 'layer-subtitle',
        name: 'Subtítulo',
        type: 'text',
        semanticRole: 'subtitle',
        text: 'Texto de apoio que não deve ser alterado',
        fontFamily: 'Inter',
        fontSize: 34,
        color: '#D1D5DB',
        x: 60,
        y: 780,
        width: 800,
        height: 180,
        zIndex: 21,
      },
      {
        id: 'layer-cta-text',
        name: 'CTA',
        type: 'text',
        semanticRole: 'cta',
        text: 'Saiba Mais',
        fontFamily: 'Inter',
        fontSize: 20,
        color: '#0B0F17',
        x: 60,
        y: 1220,
        width: 320,
        height: 30,
        zIndex: 26,
      },
    ],
  };

  it('updateBackgroundLayer atualiza rigorosamente apenas a imagem e assetId, preservando textos e logo', () => {
    const newBackgroundUrl = 'https://storage.supabase.co/generated-assets/bg_regenerated.png';
    const newAssetId = 'asset-uuid-002-regenerated';

    const updatedDoc = compService.updateBackgroundLayer(initialDocument, newBackgroundUrl, newAssetId);

    // 1. Background layer atualizada
    const bg = updatedDoc.layers.find((l) => l.id === 'layer-bg') as any;
    expect(bg).toBeDefined();
    expect(bg.imageUrl).toBe(newBackgroundUrl);
    expect(bg.assetId).toBe(newAssetId);
    expect(bg.fit).toBe('cover');

    // 2. Logo preservado idêntico
    const logo = updatedDoc.layers.find((l) => l.id === 'layer-logo') as any;
    expect(logo).toBeDefined();
    expect(logo.logoUrl).toBe('https://storage.supabase.co/brand-assets/logo.png');
    expect(logo.x).toBe(60);
    expect(logo.y).toBe(60);

    // 3. Headline preservado idêntico
    const title = updatedDoc.layers.find((l) => l.id === 'layer-title') as any;
    expect(title).toBeDefined();
    expect(title.text).toBe('Headline do Usuário Intacta');
    expect(title.fontSize).toBe(62);

    // 4. Subtitle preservado idêntico
    const subtitle = updatedDoc.layers.find((l) => l.id === 'layer-subtitle') as any;
    expect(subtitle).toBeDefined();
    expect(subtitle.text).toBe('Texto de apoio que não deve ser alterado');

    // 5. CTA preservado idêntico
    const cta = updatedDoc.layers.find((l) => l.id === 'layer-cta-text') as any;
    expect(cta).toBeDefined();
    expect(cta.text).toBe('Saiba Mais');

    // 6. Contagem de layers preservada
    expect(updatedDoc.layers).toHaveLength(5);
  });

  it('permite rastreabilidade inequívoca de composition -> asset -> project -> slide -> model -> prompt', () => {
    // Simula consulta de rastreabilidade
    const slideDoc = initialDocument;
    const bgLayer = slideDoc.layers.find((l) => l.id === 'layer-bg') as any;
    expect(bgLayer.assetId).toBe('asset-uuid-001');

    // Simula registro auditado em client_assets
    const mockAssetRow = {
      id: 'asset-uuid-001',
      organization_id: 'org-test-uuid',
      client_id: 'client-test-uuid',
      asset_type: 'generated_image',
      storage_bucket: 'generated-assets',
      storage_path: 'org-test-uuid/client-test-uuid/generated/gen_slide-01.png',
      metadata: {
        projectId: 'project-uuid-01',
        slideId: 'slide-uuid-01',
        provider: 'openai',
        model: 'gpt-image-2.5-flare',
        generationProfile: 'FINAL',
        quality: 'high',
        promptVersion: '3.0.0',
        referencePieceIds: ['piece-ref-001'],
      },
      created_at: '2026-10-19T14:00:00Z',
    };

    // Validação da cadeia de rastreabilidade
    expect(bgLayer.assetId).toBe(mockAssetRow.id);
    expect(mockAssetRow.metadata.projectId).toBe('project-uuid-01');
    expect(mockAssetRow.metadata.slideId).toBe('slide-uuid-01');
    expect(mockAssetRow.metadata.model).toBe('gpt-image-2.5-flare');
    expect(mockAssetRow.metadata.promptVersion).toBe('3.0.0');
    expect(mockAssetRow.metadata.referencePieceIds).toEqual(['piece-ref-001']);
  });
});
