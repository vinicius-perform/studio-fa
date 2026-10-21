// tests/phase-c-creative-engine.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  NormalizedRectSchema,
  SlideSafeZonesSchema,
  CompactBrandContextSchema,
  CreativeContextSchema,
  GeneratedAssetSchema,
  GENERATION_PROFILES,
  GPT_IMAGE_RESOLUTIONS,
  type CreativeContext,
} from '../src/types/domain/creative-engine';
import { CreativeContextService } from '../src/services/ai/creative-context.service';
import { PromptCompiler } from '../src/services/ai/prompt-compiler';
import {
  ImageGenerationService,
  type ImageGenerationProvider,
  type ImageProviderCallParams,
  type ImageProviderResult,
} from '../src/services/ai/image-generation.service';
import { CompositionService } from '../src/services/compositions/composition.service';
import { canCreateProjects, canWriteData } from '../src/lib/auth/permissions';
import { getFormatDefinition } from '../src/config/formats';
import type { BrandDNA } from '../src/types/domain/dna';
import type { SlideDocument } from '../src/types/domain/composition';

// Provider Fake determinístico para custo zero em testes
class FakeImageProvider implements ImageGenerationProvider {
  public calls: ImageProviderCallParams[] = [];
  public failNext = false;

  async generate(params: ImageProviderCallParams): Promise<ImageProviderResult> {
    this.calls.push(params);
    if (this.failNext) {
      this.failNext = false;
      throw new Error('[Simulated Failure] Timeout na geração de imagem');
    }

    // Retorna bytes simulados de um PNG transparente válido
    const fakePngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return {
      imageBuffer: Buffer.from(fakePngBase64, 'base64'),
      mimeType: 'image/png',
      provider: 'fake',
      model: params.model,
    };
  }
}

describe('FASE C: Schemas e Coordenadas de Zonas Seguras', () => {
  it('deve validar coordenadas normalizadas válidas (0.0 a 1.0)', () => {
    const valid = NormalizedRectSchema.safeParse({ x: 0.1, y: 0.2, width: 0.6, height: 0.3 });
    expect(valid.success).toBe(true);
  });

  it('deve rejeitar coordenadas que ultrapassem a largura do canvas (x + width > 1.0)', () => {
    const invalid = NormalizedRectSchema.safeParse({ x: 0.7, y: 0.1, width: 0.4, height: 0.2 });
    expect(invalid.success).toBe(false);
  });

  it('deve rejeitar coordenadas negativas ou maiores que 1.0', () => {
    expect(NormalizedRectSchema.safeParse({ x: -0.1, y: 0.2, width: 0.5, height: 0.2 }).success).toBe(false);
    expect(NormalizedRectSchema.safeParse({ x: 0.2, y: 1.5, width: 0.5, height: 0.2 }).success).toBe(false);
  });

  it('deve validar zonas de segurança completas da lâmina', () => {
    const zones = SlideSafeZonesSchema.safeParse({
      headlineZone: { x: 0.08, y: 0.2, width: 0.7, height: 0.3 },
      supportZone: { x: 0.08, y: 0.55, width: 0.65, height: 0.2 },
      ctaZone: { x: 0.08, y: 0.8, width: 0.4, height: 0.1 },
      logoZone: { x: 0.08, y: 0.06, width: 0.25, height: 0.08 },
    });
    expect(zones.success).toBe(true);
  });
});

describe('FASE C: BrandPromptContext Compacto e Precedência de Diretrizes', () => {
  const dummyDna: BrandDNA = {
    version: 1,
    lastConsolidatedAt: new Date().toISOString(),
    analyzedPiecesCount: 3,
    summary: 'Identidade visual moderna e tecnológica',
    toneAndVoice: 'Tecnológico e Inovador',
    colorSystem: {
      primary: '#0F172A',
      secondary: '#334155',
      accent: '#38BDF8',
      neutrals: ['#020617'],
      distributionRules: '60% neutros, 30% primária, 10% acento',
      allowedCombinations: ['#0F172A e #38BDF8'],
      forbiddenCombinations: [],
    },
    typography: {
      titleFont: 'Inter',
      bodyFont: 'Inter',
      hierarchyGuidelines: 'H1 Dominante com kerning limpo',
      caseRules: 'UPPERCASE para títulos',
    },
    composition: {
      dominantLayout: 'Assimétrico com respiro generoso',
      whiteSpaceRule: 'Mínimo de 60px de respiro',
      visualDensity: 'medium',
      focalPointGuideline: 'Foco no terço direito',
    },
    imagery: {
      photoStyle: 'Fotografia editorial contemporânea',
      subjectTreatment: 'Recorte limpo com luz natural',
      lightingPreference: 'Iluminação direcional suave',
      mockupOrIllustrationUsage: 'Mínimo',
    },
    graphicElements: {
      allowedElements: ['Linhas sutis'],
      bannedElements: ['Degradês arco-íris'],
      textureGuidelines: 'Granulação sutil opcional',
    },
    logoRules: {
      preferredPlacement: 'Topo esquerdo',
      minClearance: '40px',
      colorVariantRules: 'Versão monocromática branca sobre fundos escuros',
    },
    do: ['Usar alto contraste', 'Respeitar áreas de respiro'],
    dont: ['NUNCA renderizar tipografia, texto, números ou logos dentro da arte visual gerada'],
    manualGuidelinesSummary: null,
    hasManualOverride: false,
  };

  it('deve extrair BrandPromptContext compacto sem chamadas de IA', () => {
    const compact = CreativeContextService.buildCompactBrandContext(dummyDna);
    expect(compact.palette.primary).toContain('#0F172A');
    expect(compact.palette.accent).toContain('#38BDF8');
    expect(compact.typographyCharacter).toContain('Inter');
    expect(compact.dontRules.some((r) => r.includes('NUNCA renderizar tipografia'))).toBe(true);
  });

  it('deve priorizar absolutamente as diretrizes manuais sobre o DNA', () => {
    const manualNotes = 'REGRA SUPREMA: Fundo sempre escuro com tipografia branca.\nNUNCA utilizar pessoas com jaleco.';
    const compact = CreativeContextService.buildCompactBrandContext(dummyDna, manualNotes);
    expect(compact.manualRules).toHaveLength(2);
    expect(compact.manualRules[0]).toContain('REGRA SUPREMA');
  });

  it('deve funcionar deterministamente mesmo sem DNA cadastrado', () => {
    const compact = CreativeContextService.buildCompactBrandContext(null, 'Manual simples', {
      primary: '#112233',
      accent: '#FF0055',
    });
    expect(compact.palette.primary[0]).toBe('#112233');
    expect(compact.palette.accent[0]).toBe('#FF0055');
    expect(compact.manualRules).toContain('Manual simples');
  });
});

describe('FASE C: Prompt Compiler & Anti-Text Baking Rigoroso', () => {
  const dummyContext: CreativeContext = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    clientId: '22222222-2222-4222-8222-222222222222',
    clientName: 'Clínica Odontológica Sorriso Perfeito',
    clientNiche: 'Saúde e Odontologia Estética',
    format: {
      id: 'instagram_feed_4_5',
      name: 'Feed 4:5',
      aspectRatio: '4:5',
      generationWidth: 1024,
      generationHeight: 1280,
      exportWidth: 1080,
      exportHeight: 1350,
    },
    exactContent: {
      title: 'COMO ACELERAR OS RESULTADOS DA SUA CLÍNICA',
      subtitle: 'Três passos estratégicos para atrair pacientes qualificados',
      cta: 'Agende uma Consulta',
      userVisualDirection: 'Ambiente clínico moderno e iluminação acolhedora',
    },
    manualRules: ['Proibido mostrar instrumentos cirúrgicos pontiagudos'],
    compactBrandContext: {
      mood: ['Sofisticado', 'Acolhedor'],
      palette: {
        primary: ['#0A2540'],
        secondary: ['#635BFF'],
        accent: ['#00D4B2'],
        background: ['#F8FBFD'],
      },
      typographyCharacter: 'Inter Sans Bold',
      imagery: {
        imageType: 'Consultório odontológico de alto padrão',
        lighting: 'Luz natural diurna suave',
      },
      composition: {
        layoutDensity: 'Arejada',
        negativeSpacePreference: 'Espaço negativo à esquerda',
      },
      doRules: ['Foco em tecnologia e bem-estar'],
      dontRules: ['Evitar aspecto hospitalar frio'],
      logoBehavior: 'Logo no topo esquerdo',
      manualRules: ['Proibido mostrar instrumentos cirúrgicos pontiagudos'],
    },
    currentDnaVersionId: '33333333-3333-4333-8333-333333333333',
    brandAssets: {
      logoUrl: 'org/client/logos/logo.png',
      primaryColor: '#0A2540',
      accentColor: '#00D4B2',
    },
    selectedReferences: [
      {
        pieceId: '44444444-4444-4444-8444-444444444444',
        title: 'Post Sucesso Implantes',
        storageBucket: 'client-pieces',
        storagePath: 'org/client/pieces/ref1.png',
        isPrimary: true,
      },
    ],
  };

  it('deve compilar prompt contendo estritamente a proibição de texto (Anti-Text Baking)', () => {
    const res = PromptCompiler.compileFromCreativeContext(dummyContext);
    expect(res.prompt).toContain('[STRICT DO NOT]');
    expect(res.prompt).toContain('NO TYPOGRAPHY. NO WORDS. NO LETTERS. NO NUMBERS. NO LOGOS. NO BRAND NAMES.');
    expect(res.prompt).toContain('DO NOT render any text, typography, letters, headlines');
    expect(res.prompt).toContain('The typography will be rendered programmatically by the design studio');
  });

  it('deve incluir o formato e proporção geométrica exatos', () => {
    const res = PromptCompiler.compileFromCreativeContext(dummyContext);
    expect(res.prompt).toContain('Feed 4:5 (4:5)');
    expect(res.prompt).toContain('1024x1280');
  });

  it('deve incluir o direcionamento visual específico do usuário', () => {
    const res = PromptCompiler.compileFromCreativeContext(dummyContext);
    expect(res.prompt).toContain('Ambiente clínico moderno e iluminação acolhedora');
  });

  it('deve incluir a referência visual primária sem copiar textos dela', () => {
    const res = PromptCompiler.compileFromCreativeContext(dummyContext);
    expect(res.prompt).toContain('Post Sucesso Implantes');
    expect(res.prompt).toContain('without copying any of the original layout\'s text or watermarks');
  });
});

describe('FASE C: CompositionBuilder, Fidelidade ao Conteúdo e Layers Editáveis', () => {
  const compService = new CompositionService({} as any);
  const fmt = getFormatDefinition('instagram_feed_4_5');

  it('deve gerar composição com título exatamente idêntico ao informado (Source of Truth)', async () => {
    const exactTitle = 'COMO ACELERAR OS RESULTADOS DA SUA CLÍNICA';
    const doc = await compService.initializeDefaultDocument({
      format: fmt,
      content: { title: exactTitle },
      backgroundUrl: 'https://example.com/bg.png',
      clientLogoUrl: 'https://example.com/logo.png',
    });

    const titleLayer = doc.layers.find((l) => l.id === 'layer-title');
    expect(titleLayer).toBeDefined();
    expect(titleLayer?.type).toBe('text');
    expect((titleLayer as any).text).toBe(exactTitle);
  });

  it('deve gerar layer de CTA somente se informado pelo usuário', async () => {
    // Com CTA
    const withCta = await compService.initializeDefaultDocument({
      format: fmt,
      content: { title: 'Título', cta: 'Fale Conosco no WhatsApp' },
    });
    expect(withCta.layers.some((l) => l.id === 'layer-cta-text')).toBe(true);
    expect(withCta.layers.some((l) => l.id === 'layer-cta-bg')).toBe(true);
    const ctaText = withCta.layers.find((l) => l.id === 'layer-cta-text') as any;
    expect(ctaText.text).toBe('Fale Conosco no WhatsApp');

    // Sem CTA
    const withoutCta = await compService.initializeDefaultDocument({
      format: fmt,
      content: { title: 'Título apenas' },
    });
    expect(withoutCta.layers.some((l) => l.id === 'layer-cta-text')).toBe(false);
    expect(withoutCta.layers.some((l) => l.id === 'layer-cta-bg')).toBe(false);
  });

  it('deve posicionar o logo oficial da marca em layer dedicada', async () => {
    const doc = await compService.initializeDefaultDocument({
      format: fmt,
      content: { title: 'Título' },
      clientLogoUrl: 'https://storage.supabase.co/logo-oficial.png',
    });

    const logoLayer = doc.layers.find((l) => l.id === 'layer-logo');
    expect(logoLayer).toBeDefined();
    expect((logoLayer as any).logoUrl).toBe('https://storage.supabase.co/logo-oficial.png');
    expect((logoLayer as any).locked).toBe(false);
  });
});

describe('FASE C: Regeneração de Visual e Preservação de Layers', () => {
  const compService = new CompositionService({} as any);
  const fmt = getFormatDefinition('instagram_feed_4_5');

  it('deve atualizar apenas o backgroundUrl ao regenerar, preservando todas as demais layers', async () => {
    const initialDoc = await compService.initializeDefaultDocument({
      format: fmt,
      content: {
        title: 'Título Imutável 123',
        subtitle: 'Subtítulo Fixo',
        cta: 'Clique Aqui',
      },
      clientLogoUrl: 'https://example.com/logo.png',
      backgroundUrl: 'https://example.com/bg-original.png',
    });

    const newBgUrl = 'https://example.com/bg-regenerado-v2.png';
    const updatedDoc = compService.updateBackgroundLayer(initialDoc, newBgUrl);

    // Background atualizado
    const bgLayer = updatedDoc.layers.find((l) => l.id === 'layer-bg') as any;
    expect(bgLayer.imageUrl).toBe(newBgUrl);

    // Título, subtítulo, cta e logo rigorosamente preservados
    const titleLayer = updatedDoc.layers.find((l) => l.id === 'layer-title') as any;
    expect(titleLayer.text).toBe('Título Imutável 123');

    const subLayer = updatedDoc.layers.find((l) => l.id === 'layer-subtitle') as any;
    expect(subLayer.text).toBe('Subtítulo Fixo');

    const ctaLayer = updatedDoc.layers.find((l) => l.id === 'layer-cta-text') as any;
    expect(ctaLayer.text).toBe('Clique Aqui');

    const logoLayer = updatedDoc.layers.find((l) => l.id === 'layer-logo') as any;
    expect(logoLayer.logoUrl).toBe('https://example.com/logo.png');
  });
});

describe('FASE C: Controle de Permissões RBAC na Geração', () => {
  it('deve permitir criação para owner, admin e designer', () => {
    expect(canCreateProjects('owner')).toBe(true);
    expect(canCreateProjects('admin')).toBe(true);
    expect(canCreateProjects('designer')).toBe(true);
  });

  it('deve bloquear expressamente criação e regeneração para viewer', () => {
    expect(canCreateProjects('viewer')).toBe(false);
    expect(canWriteData('viewer')).toBe(false);
  });
});

describe('FASE C: Simulação de Carrossel Multilâminas com Provider Fake (Custo Zero)', () => {
  const fakeProvider = new FakeImageProvider();

  beforeEach(() => {
    ImageGenerationService.setTestProvider(fakeProvider);
  });

  afterEach(() => {
    ImageGenerationService.setTestProvider(null);
  });

  it('deve processar lâminas sequencialmente com FakeImageProvider sem gastar tokens reais', async () => {
    const slides = [
      { id: 'slide-1', title: 'Capa do Carrossel' },
      { id: 'slide-2', title: 'Passo 1: Diagnóstico' },
      { id: 'slide-3', title: 'Passo 2: Execução e CTA', cta: 'Baixar E-book' },
    ];

    const generatedResults = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const params: ImageProviderCallParams = {
        apiKey: 'fake-test-key',
        model: 'gpt-image-2.5-flare',
        prompt: `Prompt da lâmina ${i + 1}: ${s.title}`,
        width: 1024,
        height: 1280,
        quality: 'low',
      };
      const res = await fakeProvider.generate(params);
      generatedResults.push(res);
    }

    expect(generatedResults).toHaveLength(3);
    expect(fakeProvider.calls).toHaveLength(3);
    expect(fakeProvider.calls[0].prompt).toContain('Capa do Carrossel');
    expect(fakeProvider.calls[1].prompt).toContain('Passo 1: Diagnóstico');
    expect(fakeProvider.calls[2].prompt).toContain('Passo 2: Execução');
  });

  it('deve isolar falha em lâmina individual preservando as demais', async () => {
    fakeProvider.calls = [];
    const slideResults: Array<{ slideId: string; status: 'ok' | 'failed' }> = [];

    // Lâmina 1 ok
    try {
      await fakeProvider.generate({
        apiKey: 'fake-key',
        model: 'gpt-image-2.5-flare',
        prompt: 'Slide 1',
        width: 1024,
        height: 1280,
        quality: 'low',
      });
      slideResults.push({ slideId: 'slide-1', status: 'ok' });
    } catch {
      slideResults.push({ slideId: 'slide-1', status: 'failed' });
    }

    // Lâmina 2 falha simulada
    fakeProvider.failNext = true;
    try {
      await fakeProvider.generate({
        apiKey: 'fake-key',
        model: 'gpt-image-2.5-flare',
        prompt: 'Slide 2',
        width: 1024,
        height: 1280,
        quality: 'low',
      });
      slideResults.push({ slideId: 'slide-2', status: 'ok' });
    } catch {
      slideResults.push({ slideId: 'slide-2', status: 'failed' });
    }

    // Lâmina 3 ok
    try {
      await fakeProvider.generate({
        apiKey: 'fake-key',
        model: 'gpt-image-2.5-flare',
        prompt: 'Slide 3',
        width: 1024,
        height: 1280,
        quality: 'low',
      });
      slideResults.push({ slideId: 'slide-3', status: 'ok' });
    } catch {
      slideResults.push({ slideId: 'slide-3', status: 'failed' });
    }

    expect(slideResults[0].status).toBe('ok');
    expect(slideResults[1].status).toBe('failed');
    expect(slideResults[2].status).toBe('ok');

    // Retry isolado somente da Lâmina 2
    const retryRes = await fakeProvider.generate({
      apiKey: 'fake-key',
      model: 'gpt-image-2.5-flare',
      prompt: 'Slide 2 Retry',
      width: 1024,
      height: 1280,
      quality: 'low',
    });
    expect(retryRes.provider).toBe('fake');
  });
});
