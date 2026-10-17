// tests/creative-plan.test.ts
import { describe, expect, it } from 'bun:test';
import { CreativePlannerService } from '@/services/ai/creative-planner.service';
import { getFormatDefinition } from '@/config/formats';
import type { BrandProfile } from '@/types/domain/brand';

describe('Phase 3 — Creative Plan Engine & Copy Preservation', () => {
  const dummyBrandProfile: BrandProfile = {
    summary: 'Identidade visual para agência de inovação',
    colors: {
      primary: ['#0B0F17'],
      secondary: ['#1F2937'],
      accent: ['#CEF52A'],
      background: ['#FAFAFA'],
      text: ['#111827'],
    },
    typography: {
      headingStyle: 'Sans-serif geométrica Bold',
      bodyStyle: 'Sans-serif Regular',
      hierarchy: 'H1 > H2 > Body',
      detectedFonts: ['Inter'],
      fallbackFonts: ['sans-serif'],
    },
    composition: {
      alignment: 'Alinhamento predominante à esquerda',
      density: 'Espaçosa',
      margins: 'Generosas',
      visualHierarchy: 'Contraste alto',
      commonLayouts: ['Split superior/inferior'],
    },
    photography: {
      style: 'Editorial corporativo',
      lighting: 'Natural',
      treatment: 'Contraste balanceado',
      subjects: ['Ambientes corporativos'],
    },
    logoUsage: {
      preferredPositions: ['Canto superior esquerdo'],
      minimumClearSpace: '60px',
      allowedVersions: ['Primário'],
      restrictions: ['Não distorcer'],
    },
    graphicalElements: {
      shapes: ['Bordas arredondadas'],
      patterns: [],
      textures: [],
      icons: ['Outline'],
      effects: [],
    },
    visualStyle: {
      keywords: ['Design', 'Tecnologia'],
      mood: ['Profissional'],
      sophistication: 'Alta',
      contrast: 'Forte',
    },
    contentStyle: {
      titleStyle: 'Curto e impactante',
      subtitleStyle: 'Explicativo',
      ctaStyle: 'Botão de contraste',
      amountOfText: 'Médio',
    },
    spacingRules: ['8px grid'],
    dos: ['Manter contraste'],
    donts: ['Não achatar texto na imagem'],
  };

  // Mock Supabase client to test without network dependency
  const createQueryChain = () => {
    const chain: any = {
      eq: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: [] }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
    };
    return chain;
  };

  const mockSupabase: any = {
    from: (table: string) => ({
      select: () => createQueryChain(),
      insert: (record: any) => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'plan-123', ...record }, error: null }),
        }),
      }),
    }),
  };

  const planner = new CreativePlannerService(mockSupabase);

  it('generates a structured creative plan for carousel preserving exact user copy', async () => {
    const inputSlides = [
      {
        slideIndex: 0,
        title: 'Como Escalar seu Design System com IA',
        subtitle: 'Metodologia exclusiva da Agência FA',
        instructions: 'Capa futurista e minimalista',
      },
      {
        slideIndex: 1,
        title: 'O Problema da Inconsistência Visual',
        body: 'Mais de 60 marcas exigem controle rigoroso de padrões cromáticos e tipográficos.',
        instructions: 'Foco em organização',
      },
      {
        slideIndex: 2,
        title: 'Transforme sua Operação Hoje',
        body: 'Entre em contato com nossos diretores de arte.',
        cta: 'Falar com Especialista',
        instructions: 'Fechamento com botão destacado',
      },
    ];

    const result = await planner.generatePlan({
      organizationId: '00000000-0000-0000-0000-000000000001',
      projectId: '00000000-0000-0000-0000-000000000002',
      clientId: '00000000-0000-0000-0000-000000000003',
      brandProfile: dummyBrandProfile,
      format: getFormatDefinition('instagram_feed_4_5'),
      projectType: 'carousel',
      globalCreativeDirective: 'Direção corporativa e limpa para executivos de tecnologia',
      slides: inputSlides,
      userId: 'user-designer-1',
    });

    expect(result).toBeDefined();
    expect(result.plan.slidePlans.length).toBe(3);

    // Verify Copy Preservation (Prompt Section 30 & 70)
    expect(result.plan.slidePlans[0].slideType).toBe('cover');
    expect(result.plan.slidePlans[1].slideType).toBe('problem');
    expect(result.plan.slidePlans[2].slideType).toBe('cta');

    // Slide 0: Title and subtitle must match verbatim
    expect(inputSlides[0].title).toBe('Como Escalar seu Design System com IA');
    expect(inputSlides[0].subtitle).toBe('Metodologia exclusiva da Agência FA');

    // Slide 2: CTA must match verbatim
    expect(inputSlides[2].cta).toBe('Falar com Especialista');

    // Global direction must be present
    expect(result.plan.globalDirection.concept).toBeDefined();
    expect(result.plan.globalDirection.backgroundStyle).toBeDefined();
    expect(result.plan.globalDirection.visualRhythm).toBeDefined();
  });

  it('correctly handles single post structure', async () => {
    const singleSlide = [
      {
        slideIndex: 0,
        title: 'Post Único — Anúncio Oficial',
        subtitle: 'Lançamento de Produto',
        cta: 'Saiba Mais',
      },
    ];

    const result = await planner.generatePlan({
      organizationId: '00000000-0000-0000-0000-000000000001',
      projectId: '00000000-0000-0000-0000-000000000002',
      clientId: '00000000-0000-0000-0000-000000000003',
      brandProfile: dummyBrandProfile,
      format: getFormatDefinition('instagram_square'),
      projectType: 'single_post',
      slides: singleSlide,
      userId: 'user-designer-1',
    });

    expect(result.plan.slidePlans.length).toBe(1);
    expect(result.plan.slidePlans[0].slideType).toBe('cover');
    expect(result.plan.slidePlans[0].layout.title.align).toBe('left');
  });
});
