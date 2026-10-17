// tests/prompt-compiler.test.ts
import { describe, expect, it } from 'bun:test';
import { PromptCompiler } from '@/services/ai/prompt-compiler';
import { getFormatDefinition } from '@/config/formats';
import type { BrandProfile } from '@/types/domain/brand';

describe('Phase 3 — Prompt Compiler Engine & Anti-Text Baking', () => {
  const dummyBrandProfile: BrandProfile = {
    summary: 'Identidade visual corporativa minimalista com alta sofisticação',
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
      alignment: 'Esquerda com margens generosas',
      density: 'Espaçosa',
      margins: '80px',
      visualHierarchy: 'Contraste alto',
      commonLayouts: ['Split superior/inferior'],
    },
    photography: {
      style: 'Editorial studio',
      lighting: 'Luz direcional suave',
      treatment: 'Tons limpos e naturais',
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
      patterns: ['Grid sutil'],
      textures: [],
      icons: ['Outline'],
      effects: [],
    },
    visualStyle: {
      keywords: ['Design', 'Tecnologia'],
      mood: ['Sofisticado', 'Moderno'],
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
    dos: ['Manter espaço para texto'],
    donts: ['Não desenhar letras'],
  };

  const feedFormat = getFormatDefinition('instagram_feed_4_5');

  it('compiles all 10 mandatory structured prompt sections', () => {
    const result = PromptCompiler.compile({
      brandProfile: dummyBrandProfile,
      format: feedFormat,
      slidePlan: {
        slideIndex: 0,
        slideType: 'cover',
        visualConcept: 'Capa impactante com iluminação tecnológica',
        imageStrategy: 'generate_new_image',
        imagePrompt: 'Composição arquitetônica contemporânea com reflexos sutis',
        layout: {
          title: { x: 0.08, y: 0.25, width: 0.55, align: 'left' },
          subtitle: { x: 0.08, y: 0.52, width: 0.65, align: 'left' },
        },
      } as any,
      content: {
        title: 'Revolução da IA no Design',
        subtitle: 'Como grandes agências escalam entregas',
      },
    });

    expect(result.prompt).toContain('[OBJECTIVE]');
    expect(result.prompt).toContain('[BRAND DIRECTION]');
    expect(result.prompt).toContain('[SCENE]');
    expect(result.prompt).toContain('[COMPOSITION & NEGATIVE SPACE]');
    expect(result.prompt).toContain('[PHOTOGRAPHY & LIGHTING]');
    expect(result.prompt).toContain('[COLOR PALETTE]');
    expect(result.prompt).toContain('[GRAPHIC STYLE]');
    expect(result.prompt).toContain('[REFERENCE GUIDANCE]');
    expect(result.prompt).toContain('[CONSTRAINTS]');
    expect(result.prompt).toContain('[STRICT DO NOT]');
  });

  it('strictly forbids text baking in DO NOT section', () => {
    const result = PromptCompiler.compile({
      brandProfile: dummyBrandProfile,
      format: feedFormat,
      slidePlan: {
        slideIndex: 0,
        slideType: 'cover',
        visualConcept: 'Visual conceitual',
        imageStrategy: 'generate_new_image',
        imagePrompt: 'Espaço conceitual',
        layout: {
          title: { x: 0.08, y: 0.25, width: 0.55, align: 'left' },
        },
      } as any,
      content: {
        title: 'Título de Exemplo',
      },
    });

    // Verification of anti-text baking rules (Prompt Section 54)
    expect(result.sections.doNot).toContain('DO NOT render any text');
    expect(result.sections.doNot).toContain('typography');
    expect(result.sections.doNot).toContain('headlines');
    expect(result.sections.doNot).toContain('watermarks');
    expect(result.sections.doNot).toContain('negative space');
  });

  it('calculates correct negative space based on text bounding box coordinates', () => {
    // Left-aligned title (x: 0.08, width: 0.55) -> Negative space on LEFT
    const leftResult = PromptCompiler.compile({
      brandProfile: dummyBrandProfile,
      format: feedFormat,
      slidePlan: {
        slideIndex: 0,
        slideType: 'cover',
        visualConcept: 'Conceito',
        imageStrategy: 'generate_new_image',
        imagePrompt: 'Cenário',
        layout: {
          title: { x: 0.08, y: 0.25, width: 0.55, align: 'left' },
        },
      } as any,
      content: { title: 'Texto à Esquerda' },
    });

    expect(leftResult.negativeSpaceInstruction).toContain('LEFT half');

    // Right-aligned title (x: 0.45, width: 0.5) -> Negative space on RIGHT
    const rightResult = PromptCompiler.compile({
      brandProfile: dummyBrandProfile,
      format: feedFormat,
      slidePlan: {
        slideIndex: 1,
        slideType: 'content',
        visualConcept: 'Conceito 2',
        imageStrategy: 'generate_new_image',
        imagePrompt: 'Cenário 2',
        layout: {
          title: { x: 0.45, y: 0.25, width: 0.5, align: 'right' },
        },
      } as any,
      content: { title: 'Texto à Direita' },
    });

    expect(rightResult.negativeSpaceInstruction).toContain('RIGHT half');
  });

  it('correctly includes variation instruction override', () => {
    const variation = PromptCompiler.compile({
      brandProfile: dummyBrandProfile,
      format: feedFormat,
      slidePlan: {
        slideIndex: 1,
        slideType: 'content',
        visualConcept: 'Conceito',
        imageStrategy: 'generate_new_image',
        imagePrompt: 'Iluminação de estúdio',
        layout: {
          title: { x: 0.08, y: 0.25, width: 0.55, align: 'left' },
        },
      } as any,
      content: { title: 'Variação' },
      customVariationInstruction: 'Tons mais escuros com luz de recorte verde',
    });

    expect(variation.sections.scene).toContain('Variation override instruction: Tons mais escuros com luz de recorte verde');
  });

  it('integrates visual reference inspiration while strictly forbidding copying baked text', () => {
    const result = PromptCompiler.compile({
      brandProfile: dummyBrandProfile,
      format: feedFormat,
      slidePlan: {
        visualConcept: 'Post sobre liderança com referência visual',
        layout: {
          title: { x: 0.1, y: 0.2, width: 0.5, align: 'left' },
        },
      },
      content: { title: 'Liderança Eficaz' },
      referenceTitle: 'Peça Referência - Post Minimalista Dark',
      referenceImageUrl: 'data:image/png;base64,sample',
    });

    expect(result.sections.referenceGuidance).toContain('Peça Referência - Post Minimalista Dark');
    expect(result.sections.referenceGuidance).toContain("without copying any of the original layout's text or watermarks");
    expect(result.sections.doNot).toContain('DO NOT render any text, typography, letters');
  });
});
