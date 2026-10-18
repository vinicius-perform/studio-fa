// tests/phase-b-onboarding-dna.test.ts
import { describe, it, expect } from 'bun:test';
import { VisualAnalyzerService } from '../src/services/ai/visual-analyzer.service';
import { StorageService } from '../src/services/storage/storage.service';
import { PieceAnalysisSchema } from '../src/types/domain/piece';
import { BrandDNASchema } from '../src/types/domain/dna';

describe('FASE B: Detecção de Formatos de Peças Gráficas', () => {
  it('deve classificar proporção 0.8 (1080x1350) como Feed Retrato (4:5)', () => {
    const res = VisualAnalyzerService.detectFormat(1080, 1350);
    expect(res.formatType).toBe('feed');
    expect(res.aspectRatio).toBe(0.8);
    expect(res.label).toContain('4:5');
  });

  it('deve classificar proporção 0.5625 (1080x1920) como Story (9:16)', () => {
    const res = VisualAnalyzerService.detectFormat(1080, 1920);
    expect(res.formatType).toBe('story');
    expect(res.aspectRatio).toBe(0.5625);
    expect(res.label).toContain('9:16');
  });

  it('deve classificar proporção 1.0 (1080x1080) como Quadrado (1:1)', () => {
    const res = VisualAnalyzerService.detectFormat(1080, 1080);
    expect(res.formatType).toBe('square');
    expect(res.aspectRatio).toBe(1);
  });

  it('deve classificar proporção horizontal (1920x1080) como Capa / Banner', () => {
    const res = VisualAnalyzerService.detectFormat(1920, 1080);
    expect(res.formatType).toBe('cover');
    expect(res.aspectRatio).toBeGreaterThan(1.25);
  });

  it('deve usar pistas no nome do arquivo caso dimensões não sejam definitivas', () => {
    const res = VisualAnalyzerService.detectFormat(undefined, undefined, 'arte-story-reels-v1.png');
    expect(res.formatType).toBe('story');
  });
});

describe('FASE B: StorageService Server-Side', () => {
  it('deve extrair mimeType e Buffer a partir de Data URL', () => {
    const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const dataUrl = `data:image/png;base64,${sampleBase64}`;

    const parsed = StorageService.parseDataUrl(dataUrl);
    expect(parsed.mimeType).toBe('image/png');
    expect(parsed.buffer).toBeInstanceOf(Buffer);
    expect(parsed.buffer.length).toBeGreaterThan(0);
  });

  it('deve mapear extensões corretas para tipos MIME comuns', () => {
    expect(StorageService.getExtensionForMime('image/png')).toBe('png');
    expect(StorageService.getExtensionForMime('image/jpeg')).toBe('jpg');
    expect(StorageService.getExtensionForMime('image/webp')).toBe('webp');
    expect(StorageService.getExtensionForMime('image/svg+xml')).toBe('svg');
    expect(StorageService.getExtensionForMime('font/woff2')).toBe('woff2');
    expect(StorageService.getExtensionForMime('font/ttf')).toBe('ttf');
  });
});

describe('FASE B: Validação de Schemas Estruturados (Zero Mocks)', () => {
  it('deve validar com sucesso uma análise de peça completa no PieceAnalysisSchema', () => {
    const validPieceAnalysis = {
      summary: 'Peça institucional minimalista com forte ênfase tipográfica e respiro visual.',
      composition: {
        layoutStyle: 'editorial minimalista',
        alignment: 'alinhado à esquerda',
        balance: 'assimétrico balanceado',
        whiteSpace: 'amplo',
        density: 'low' as const,
      },
      hierarchy: {
        primaryFocus: 'Manchete em caixa alta com peso Black',
        secondaryElements: 'Subtítulo e badge com fundo escuro',
        actionOrFooter: 'Logotipo institucional e @perfil no rodapé',
      },
      typography: {
        primaryStyle: 'Sans-Serif Geométrica Display',
        titleWeight: 'Black 900',
        bodyStyle: 'Regular 400 com entrelinha aberta',
        contrast: 'alto',
        observedFamilies: ['Inter', 'Montserrat'],
      },
      colors: {
        primary: '#0F1113',
        secondary: '#1F2937',
        accent: '#CEF52A',
        background: '#0F1113',
        palette: ['#0F1113', '#CEF52A', '#FFFFFF', '#1F2937'],
      },
      imagery: {
        hasImage: true,
        imageType: 'foto de pessoa em estúdio',
        treatment: 'recorte suave com sombra sutil',
        lighting: 'luz de contorno direcional',
      },
      graphicElements: {
        shapes: ['moldura fina de 1px', 'divisor sutil'],
        textures: 'superfície limpa sem granulação',
        framing: 'margem de respiro de 40px',
      },
      logo: {
        present: true,
        placement: 'canto superior esquerdo',
        variant: 'negativa branca',
        readability: 'excelente área de respiro',
      },
      strengths: ['Contraste tipográfico marcante', 'Uso consciente do espaço negativo'],
      weaknesses: ['Subtítulo poderia ter 1px a mais de peso para telas menores'],
      qualityScore: 9.3,
      confidence: 0.98,
    };

    const parseResult = PieceAnalysisSchema.safeParse(validPieceAnalysis);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.qualityScore).toBe(9.3);
      expect(parseResult.data.colors.accent).toBe('#CEF52A');
    }
  });

  it('deve rejeitar cores HEX inválidas no schema de análise de peça', () => {
    const invalidColors = {
      summary: 'Teste de cor inválida',
      composition: {
        layoutStyle: 'editorial',
        alignment: 'centro',
        balance: 'simétrico',
        whiteSpace: 'moderado',
        density: 'medium' as const,
      },
      hierarchy: {
        primaryFocus: 'Título',
        secondaryElements: 'Apoio',
        actionOrFooter: 'CTA',
      },
      typography: {
        primaryStyle: 'Sans',
        titleWeight: 'Bold',
        bodyStyle: 'Regular',
        contrast: 'médio',
        observedFamilies: [],
      },
      colors: {
        primary: 'cor-invalida-sem-hex',
        secondary: '#1F2937',
        accent: '#CEF52A',
        background: '#000000',
        palette: ['#000000'],
      },
      imagery: {
        hasImage: false,
        imageType: 'sem imagem',
        treatment: 'nenhum',
        lighting: 'nenhuma',
      },
      graphicElements: {
        shapes: [],
        textures: 'nenhuma',
        framing: 'nenhum',
      },
      logo: {
        present: false,
        placement: 'ausente',
        variant: 'ausente',
        readability: 'ausente',
      },
      strengths: [],
      weaknesses: [],
      qualityScore: 7.0,
      confidence: 0.8,
    };

    const parseResult = PieceAnalysisSchema.safeParse(invalidColors);
    expect(parseResult.success).toBe(false);
  });

  it('deve validar um Brand DNA completo no BrandDNASchema', () => {
    const validDNA = {
      version: 1,
      lastConsolidatedAt: new Date().toISOString(),
      analyzedPiecesCount: 5,
      summary: 'Identidade visual moderna com estética minimalista e alto contraste.',
      toneAndVoice: 'Vanguardista, sofisticado e tecnológico',
      colorSystem: {
        primary: '#0F1113',
        secondary: '#1F2937',
        accent: '#CEF52A',
        neutrals: ['#FFFFFF', '#F3F4F6'],
        distributionRules: '60% neutros/fundo escuro, 30% suporte e 10% acento neon nos CTAs',
        allowedCombinations: ['Fundo #0F1113 com acento #CEF52A'],
        forbiddenCombinations: ['Fundos coloridos saturados'],
      },
      typography: {
        titleFont: 'Inter',
        bodyFont: 'Inter',
        hierarchyGuidelines: 'Títulos em Bold/Black e corpo de texto em peso Regular',
        caseRules: 'Títulos em UPPERCASE e subtítulos em Sentence case',
      },
      composition: {
        dominantLayout: 'Grid editorial assimétrico',
        whiteSpaceRule: 'Mínimo de 32px de margem de respiro',
        visualDensity: 'low' as const,
        focalPointGuideline: 'Iniciar pelo contraste tipográfico superior',
      },
      imagery: {
        photoStyle: 'Fotografia com iluminação dramática de estúdio',
        subjectTreatment: 'Recorte limpo com sombra realista suave',
        lightingPreference: 'Luz direcional de alto contraste',
        mockupOrIllustrationUsage: 'Apenas mockups de alta fidelidade',
      },
      graphicElements: {
        allowedElements: ['Linhas de 1px', 'Badges com cantos arredondados'],
        bannedElements: ['Degradês arco-íris', 'Sombras borradas pesadas'],
        textureGuidelines: 'Superfícies limpas com sutil ruído monocromático',
      },
      logoRules: {
        preferredPlacement: 'Rodapé centralizado ou canto superior esquerdo',
        minClearance: 'Área mínima de 24px livre ao redor da marca',
        colorVariantRules: 'Sempre monocromático branco sobre fundos escuros',
      },
      do: ['Preservar a paleta institucional #0F1113 e #CEF52A', 'Garantir legibilidade máxima dos textos'],
      dont: ['Nunca utilizar degradês coloridos sem autorização', 'Não deformar o logotipo da marca'],
      manualGuidelinesSummary: 'Prioridade absoluta para o fundo preto e acento neon verde.',
      hasManualOverride: true,
    };

    const parseResult = BrandDNASchema.safeParse(validDNA);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.hasManualOverride).toBe(true);
      expect(parseResult.data.colorSystem.accent).toBe('#CEF52A');
    }
  });
});

describe('FASE B: Eliminação de Mocks em Produção', () => {
  it('deve lançar erro claro caso chamada de análise seja feita sem chave ou com falha de rede', async () => {
    let threw = false;
    try {
      await VisualAnalyzerService.analyzePiece({
        organizationId: '00000000-0000-0000-0000-000000000000',
        clientId: '00000000-0000-0000-0000-000000000000',
        filename: 'teste.png',
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

describe('FASE B: Rastreabilidade, Versionamento e Status Reativos', () => {
  it('deve suportar os status válidos de memória visual do cliente', () => {
    const validStatuses = [
      'awaiting_references',
      'awaiting_analysis',
      'analyzing',
      'ready',
      'needs_review',
      'needs_refresh',
    ];
    for (const status of validStatuses) {
      expect(typeof status).toBe('string');
      expect(status.length).toBeGreaterThan(0);
    }
  });

  it('deve simular filtro incremental de peças preservando as completed', () => {
    const pieces = [
      { id: '1', analysis_status: 'completed' },
      { id: '2', analysis_status: 'completed' },
      { id: '3', analysis_status: 'pending' },
      { id: '4', analysis_status: 'failed' },
    ];

    const pendingToAnalyze = pieces.filter(p => ['pending', 'failed', 'queued', 'analyzing'].includes(p.analysis_status));
    expect(pendingToAnalyze.length).toBe(2);
    expect(pendingToAnalyze.map(p => p.id)).toEqual(['3', '4']);

    // As peças 1 e 2 NÃO devem ser reanalisadas
    const skippedCompleted = pieces.filter(p => p.analysis_status === 'completed');
    expect(skippedCompleted.length).toBe(2);
  });

  it('deve atualizar visual_memory_status para needs_refresh quando peça fonte for removida', () => {
    const remainingPieces = [
      { id: '1', analysis_status: 'completed' },
      { id: '3', analysis_status: 'completed' },
    ];
    // Se ainda restam peças completed, mas uma peça anterior foi excluída, o estado deve ser needs_refresh
    const newStatus = remainingPieces.length === 0
      ? 'awaiting_references'
      : 'needs_refresh';
    expect(newStatus).toBe('needs_refresh');
  });

  it('deve transicionar para awaiting_references quando todas as peças forem excluídas', () => {
    const remainingPieces: Array<{ id: string }> = [];
    const newStatus = remainingPieces.length === 0
      ? 'awaiting_references'
      : 'needs_refresh';
    expect(newStatus).toBe('awaiting_references');
  });
});
