// tests/composition-document.test.ts
import { describe, expect, it } from 'bun:test';
import { CompositionService } from '@/services/compositions/composition.service';
import { getFormatDefinition } from '@/config/formats';
import { fitTextToBox, type SlideDocument, type TextLayer } from '@/types/domain/composition';
import { ConflictError } from '@/lib/errors';

describe('Phase 3 — Composition Document & Layer Management', () => {
  const feedFormat = getFormatDefinition('instagram_feed_4_5');

  // In-memory mock supabase store for compositions
  const inMemoryStore: Record<string, any> = {};

  const mockSupabase: any = {
    from: (table: string) => ({
      select: () => ({
        eq: (col1: string, val1: string) => ({
          eq: (col2: string, val2: string) => ({
            maybeSingle: () => Promise.resolve({ data: inMemoryStore[val1] || null, error: null }),
          }),
        }),
      }),
      insert: (record: any) => {
        inMemoryStore[record.slide_id] = { ...record };
        return {
          select: () => ({
            single: () => Promise.resolve({ data: inMemoryStore[record.slide_id], error: null }),
          }),
        };
      },
      update: (updates: any) => ({
        eq: (col1: string, slideId: string) => ({
          eq: (col2: string, orgId: string) => {
            const current = inMemoryStore[slideId];
            inMemoryStore[slideId] = { ...current, ...updates };
            return {
              select: () => ({
                single: () => Promise.resolve({ data: inMemoryStore[slideId], error: null }),
              }),
            };
          },
        }),
      }),
    }),
  };

  const compService = new CompositionService(mockSupabase);

  it('initializes default multi-layer document with official logo and editable copy', async () => {
    const doc = await compService.initializeDefaultDocument({
      format: feedFormat,
      brandProfile: {
        summary: 'Marca Tech',
        colors: { primary: ['#0B0F17'], accent: ['#CEF52A'], text: ['#FFFFFF'], secondary: [], background: [] },
        typography: { detectedFonts: ['Inter'] },
      } as any,
      content: {
        title: 'Título Principal do Anúncio',
        subtitle: 'Subtítulo explicativo com mais detalhes',
        cta: 'Acessar Agora',
      },
      clientLogoUrl: 'https://example.com/logo.svg',
      backgroundUrl: 'https://example.com/bg.png',
    });

    expect(doc.canvas.width).toBe(1080);
    expect(doc.canvas.height).toBe(1350);

    // Verify all layers are created
    const bgLayer = doc.layers.find((l) => l.id === 'layer-bg');
    const overlayLayer = doc.layers.find((l) => l.id === 'layer-overlay');
    const logoLayer = doc.layers.find((l) => l.id === 'layer-logo');
    const titleLayer = doc.layers.find((l) => l.id === 'layer-title') as TextLayer;
    const ctaLayer = doc.layers.find((l) => l.id === 'layer-cta-text') as TextLayer;

    expect(bgLayer).toBeDefined();
    expect(overlayLayer).toBeDefined();
    expect(logoLayer).toBeDefined();
    expect(titleLayer).toBeDefined();
    expect(ctaLayer).toBeDefined();

    // Verify z-index hierarchy
    expect(bgLayer!.zIndex).toBeLessThan(overlayLayer!.zIndex);
    expect(overlayLayer!.zIndex).toBeLessThan(logoLayer!.zIndex);
    expect(logoLayer!.zIndex).toBeLessThan(titleLayer!.zIndex);

    // Verify text is NOT flattened
    expect(titleLayer.text).toBe('Título Principal do Anúncio');
    expect(titleLayer.type).toBe('text');
  });

  it('performs progressive font-size scaling with fitTextToBox', () => {
    // 1. Text fits comfortably -> font size unchanged
    const resultFit = fitTextToBox({
      text: 'Texto curto',
      fontSize: 48,
      boxWidth: 800,
      boxHeight: 200,
      minFontSize: 16,
    });
    expect(resultFit.fontSize).toBe(48);
    expect(resultFit.overflowWarning).toBe(false);

    // 2. Long text in small box -> scaled down
    const resultScaled = fitTextToBox({
      text: 'Este é um parágrafo bastante longo que definitivamente não caberia em uma única linha com fonte de tamanho grande dentro de uma caixa com altura restrita.',
      fontSize: 64,
      boxWidth: 400,
      boxHeight: 120,
      minFontSize: 16,
    });
    expect(resultScaled.fontSize).toBeLessThan(64);

    // 3. Impossibly massive text in tiny box -> reaches minFontSize and triggers overflowWarning
    const massiveText = 'Texto '.repeat(150);
    const resultOverflow = fitTextToBox({
      text: massiveText,
      fontSize: 60,
      boxWidth: 200,
      boxHeight: 60,
      minFontSize: 16,
    });
    expect(resultOverflow.fontSize).toBe(16);
    expect(resultOverflow.overflowWarning).toBe(true);
  });

  it('enforces optimistic concurrency control (revision increment and conflict detection)', async () => {
    const slideId = '00000000-0000-0000-0000-000000000010';
    const orgId = '00000000-0000-0000-0000-000000000001';
    const projId = '00000000-0000-0000-0000-000000000002';

    const initialDoc: SlideDocument = {
      version: 1,
      canvas: { width: 1080, height: 1350, format: 'instagram_feed_4_5', backgroundColor: '#0B0F17' },
      layers: [],
    };

    // 1. Initial save creates revision 1
    const row1 = await compService.saveComposition({
      slideId,
      projectId: projId,
      organizationId: orgId,
      document: initialDoc,
      expectedRevision: 1,
      userId: 'designer-1',
    });
    expect(row1.revision).toBe(1);

    // 2. Next update with expectedRevision: 1 succeeds and becomes revision: 2
    const row2 = await compService.saveComposition({
      slideId,
      projectId: projId,
      organizationId: orgId,
      document: { ...initialDoc, version: 2 },
      expectedRevision: 1,
      userId: 'designer-1',
    });
    expect(row2.revision).toBe(2);

    // 3. Stale update with expectedRevision: 1 fails with ConflictError
    let conflictThrown = false;
    try {
      await compService.saveComposition({
        slideId,
        projectId: projId,
        organizationId: orgId,
        document: { ...initialDoc, version: 3 },
        expectedRevision: 1, // Stale! Current on server is 2
        userId: 'designer-2',
      });
    } catch (err: any) {
      conflictThrown = true;
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.message).toContain('revisão no servidor: 2');
    }
    expect(conflictThrown).toBe(true);
  });
});
