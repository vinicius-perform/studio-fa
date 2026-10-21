// tests/creative-chat.test.ts
import { describe, it, expect } from './support/bun-test-shim';
import { randomUUID } from 'node:crypto';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';
import {
  VisualAnalysisReportSchema,
  InterpretedCreativeIntentSchema,
} from '../src/types/domain/creative-chat';
import { canCreateProjects } from '../src/lib/auth/permissions';
import {
  ImageGenerationService,
  type ImageProviderCallParams,
  type ImageProviderResult,
} from '../src/services/ai/image-generation.service';
import { StorageService } from '../src/services/storage/storage.service';

process.env.OPENAI_API_KEY = 'sk-proj-mock-key-for-unit-tests';

// Mocks Determinísticos para testes unitários
StorageService.uploadBuffer = async () => ({
  storageBucket: 'generated-assets',
  storagePath: 'mock/generated/test.png',
  mimeType: 'image/png',
  fileSizeBytes: 2048,
});
StorageService.createSignedUrl = async () =>
  'https://rfdossffdlayntmyqpnl.supabase.co/storage/v1/object/sign/generated-assets/mock/generated/test.png';
StorageService.downloadAsBuffer = async () => Buffer.from('mock-bytes');

ImageGenerationService.setTestProvider({
  async generate(params: ImageProviderCallParams): Promise<ImageProviderResult> {
    return {
      imageBuffer: Buffer.from('mock-pixels'),
      mimeType: 'image/png',
      provider: 'fake',
      model: params.model,
    };
  },
});

describe('MVP 2.1: Modo Chat Criativo / Copiloto Criativo', () => {
  const validOrgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const validClientId = 'c14b4641-620f-463a-9afb-0352c978974c';
  const validUserId = '490e1088-6a65-42c0-a2bc-f39e57cd3253';

  function createMockSupabase() {
    return {
      from: (table: string) => {
        const queryBuilder: any = {
          select: () => queryBuilder,
          eq: () => queryBuilder,
          in: () => queryBuilder,
          order: () => queryBuilder,
          limit: () => queryBuilder,
          insert: (data: any) => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: randomUUID(),
                  ...data,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
          update: (data: any) => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { id: randomUUID(), ...data }, error: null }),
              }),
            }),
          }),
          upsert: (data: any) => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: randomUUID(),
                  ...(Array.isArray(data) ? data[0] : data),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
          maybeSingle: async () => {
            if (table === 'clients') {
              return {
                data: {
                  id: validClientId,
                  name: 'Fazendo Acontecer (FA)',
                  niche: 'Marketing & Tecnologia',
                  dna: {
                    colorSystem: {
                      primary: ['#090B0E', '#0B0F17'],
                      accent: ['#CEF52A'],
                      secondary: ['#F4F4F6', '#2A3029'],
                    },
                  },
                  manual_guidelines: 'Visual tecnológico futurista com alto contraste e verde neon de acento.',
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
          single: async () => {
            if (table === 'clients') {
              return {
                data: {
                  id: validClientId,
                  name: 'Fazendo Acontecer (FA)',
                  niche: 'Marketing & Tecnologia',
                },
                error: null,
              };
            }
            return { data: { id: 'mock-single-id' }, error: null };
          },
          then: (resolve: any) => resolve({ data: [] }),
        };
        return queryBuilder;
      },
    } as any;
  }

  // =========================================================================
  // 1. INTERPRETAÇÃO DE PROMPT CRIATIVO EM LINGUAGEM NATURAL
  // =========================================================================
  describe('1. Interpretação em Linguagem Natural (NLP Criativo)', () => {
    const service = new CreativeChatService(createMockSupabase());

    it('extrai formato 4:5, headline e CTA de solicitação natural', () => {
      const intent = service.interpretCreativePrompt(
        'gere um post 4:5 com a headline: "Como acelerar os resultados da sua clínica" e CTA: "Comente EU QUERO"'
      );

      expect(intent.format).toBe('instagram_feed_4_5');
      expect(intent.aspectRatio).toBe('4:5');
      expect(intent.projectType).toBe('single_post');
      expect(intent.headline).toBe('Como acelerar os resultados da sua clínica');
      expect(intent.cta).toBe('Comente EU QUERO');
      expect(intent.useLayoutPrintAsStructure).toBe(false);
    });

    it('detecta formato 9:16 para stories com estética editorial', () => {
      const intent = service.interpretCreativePrompt(
        'Crie um story 9:16 minimalista com o título "Masterclass Exclusiva"'
      );

      expect(intent.format).toBe('instagram_story');
      expect(intent.aspectRatio).toBe('9:16');
      expect(intent.headline).toBe('Masterclass Exclusiva');
    });

    it('detecta carrossel multilâminas quando solicitado', () => {
      const intent = service.interpretCreativePrompt(
        'Faça um carrossel de 5 lâminas sobre funil de vendas'
      );

      expect(intent.projectType).toBe('carousel');
    });

    it('ativa flag de uso de print de estrutura quando layoutPrintUrl for fornecido', () => {
      const intent = service.interpretCreativePrompt(
        'Use esse print como base de estrutura e layout para o post',
        'https://example.com/print-wireframe.png'
      );

      expect(intent.useLayoutPrintAsStructure).toBe(true);
    });
  });

  // =========================================================================
  // 2. ANÁLISE VISUAL CONVERSACIONAL ESTRUTURADA
  // =========================================================================
  describe('2. Análise Visual Estruturada (5 Seções do Copiloto)', () => {
    it('produz relatório completo validado com as 5 seções requeridas', async () => {
      const service = new CreativeChatService(createMockSupabase());

      const report = await service.analyzeVisualMemory({
        organizationId: validOrgId,
        clientId: validClientId,
        selectedPieceIds: ['piece-1', 'piece-2'],
      });

      // Validação Zod estrita
      const validated = VisualAnalysisReportSchema.parse(report);
      expect(validated).toBeDefined();

      // Conceito síntese
      expect(validated.concept).toContain('Tech Performance');

      // 1. Paleta de cores
      expect(validated.colorPalette.length).toBeGreaterThanOrEqual(3);
      const accent = validated.colorPalette.find((c) => c.isAccent);
      expect(accent).toBeDefined();
      expect(accent?.hex).toBe('#CEF52A');

      // Tabela de elementos
      expect(validated.elements.aesthetic).toBeDefined();
      expect(validated.elements.background).toBeDefined();
      expect(validated.elements.typography).toBeDefined();
      expect(validated.elements.hierarchy).toBeDefined();
      expect(validated.elements.composition).toBeDefined();

      // 2. Os três estilos predominantes (A, B e C)
      expect(validated.predominantStyles.length).toBe(3);
      expect(validated.predominantStyles[0].letter).toBe('A');
      expect(validated.predominantStyles[1].letter).toBe('B');
      expect(validated.predominantStyles[2].letter).toBe('C');

      // 3. Características marcantes
      expect(validated.recognizableFeatures.length).toBeGreaterThanOrEqual(4);

      // 4. Diretrizes (Manter vs Evitar)
      expect(validated.guidelines.keep.length).toBeGreaterThanOrEqual(4);
      expect(validated.guidelines.avoid.length).toBeGreaterThanOrEqual(4);

      // 5. Avaliação como Direção de Arte
      expect(validated.artDirectionReview.consistencyScore).toBeGreaterThanOrEqual(80);
      expect(validated.artDirectionReview.conclusion).toBeDefined();
    });
  });

  // =========================================================================
  // 3. GERAÇÃO DE PEÇA CRIATIVA E ABRIR NO STUDIO
  // =========================================================================
  describe('3. Geração Conversacional de Peça & Abertura no Studio', () => {
    it('gera peça e composição pronta para o Studio sem quebras', async () => {
      const service = new CreativeChatService(createMockSupabase());

      const piece = await service.generateChatPiece({
        organizationId: validOrgId,
        clientId: validClientId,
        userId: validUserId,
        userMessage: 'Gere um post 4:5 com headline: "Dominando o Funil" e CTA: "QUERO"',
      });

      expect(piece.projectId).toBeDefined();
      expect(piece.slideId).toBeDefined();
      expect(piece.aspectRatio).toBe('4:5');
      expect(piece.headline).toBe('Dominando o Funil');
      expect(piece.cta).toBe('QUERO');
      expect(piece.previewUrl).toBeDefined();
      expect(piece.layersCount).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 4. CONTROLE DE ACESSO RBAC
  // =========================================================================
  describe('4. RBAC: Permissões de Criação e Acesso', () => {
    it('permite que Owner, Admin e Designer criem peças no chat', () => {
      expect(canCreateProjects('owner')).toBe(true);
      expect(canCreateProjects('admin')).toBe(true);
      expect(canCreateProjects('designer')).toBe(true);
    });

    it('bloqueia estritamente Viewer (somente leitura) de criar ou gerar peças', () => {
      expect(canCreateProjects('viewer')).toBe(false);
    });
  });
});
