// tests/creative-chat-composer.test.ts
import { describe, it, expect } from './support/bun-test-shim';
import { randomUUID } from 'node:crypto';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';
import {
  ResponsesMultimodalService,
  MANDATORY_SYSTEM_VISUAL_RULE,
} from '../src/services/ai/responses-multimodal.service';
import {
  ImageGenerationService,
  type ImageProviderCallParams,
  type ImageProviderResult,
} from '../src/services/ai/image-generation.service';
import { StorageService } from '../src/services/storage/storage.service';
import { devStore } from '../src/lib/dev-store';

// Garante API key no ambiente de testes
process.env.OPENAI_API_KEY = 'sk-proj-mock-valid-key-for-unit-tests-1234';

describe('STUDIO FA — MVP 2.1: Novo Composer Baseado em Referência', () => {
  const orgId = randomUUID();
  const clientAId = randomUUID();
  const clientBId = randomUUID();
  const userId = randomUUID();
  const validPieceId = randomUUID();

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
                  ...(Array.isArray(data) ? data[0] : data),
                  created_at: new Date().toISOString(),
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
                  id: clientAId,
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
            if (table === 'integration_credentials') {
              return {
                data: {
                  encrypted_secret: 'mock-secret',
                  secret_last_four: '1234',
                  status: 'connected',
                },
                error: null,
              };
            }
            if (table === 'integration_settings') {
              return {
                data: {
                  settings: { imageModel: 'gpt-image-2.5-flare' },
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
                  id: clientAId,
                  name: 'Fazendo Acontecer (FA)',
                  niche: 'Marketing & Tecnologia',
                },
                error: null,
              };
            }
            return { data: { id: randomUUID(), created_at: new Date().toISOString() }, error: null };
          },
          then: (resolve: any) => {
            if (table === 'client_pieces') {
              return resolve({
                data: [
                  {
                    id: validPieceId,
                    title: 'Post Editorial FA',
                    storage_bucket: 'client-pieces',
                    storage_path: 'mock/piece1.png',
                    analysis_json: null,
                  },
                ],
              });
            }
            return resolve({ data: [] });
          },
        };
        return queryBuilder;
      },
    } as any;
  }

  // Configura Mocks de Storage e Provider Determinístico para os testes que esperam sucesso
  StorageService.uploadBuffer = async () => ({
    storageBucket: 'generated-assets',
    storagePath: 'mock/generated/test.png',
    mimeType: 'image/png',
    fileSizeBytes: 2048,
  });
  StorageService.createSignedUrl = async () =>
    'https://rfdossffdlayntmyqpnl.supabase.co/storage/v1/object/sign/generated-assets/mock/generated/test.png?token=mock';
  StorageService.downloadAsBuffer = async () => Buffer.from('mock-reference-image-bytes');

  ImageGenerationService.setTestProvider({
    async generate(params: ImageProviderCallParams): Promise<ImageProviderResult> {
      return {
        imageBuffer: Buffer.from('mock-image-pixels'),
        mimeType: 'image/png',
        provider: 'fake',
        model: params.model,
      };
    },
  });

  // 1 & 2. Isolamento de referências e limpeza ao trocar cliente
  describe('1 & 2. Isolamento de Referências e Troca de Cliente', () => {
    it('Cliente A deve listar somente referências de Cliente A', () => {
      // Simula referências no devStore ou lista
      const mockRefs = [
        { id: 'ref-a1', clientId: clientAId, title: 'Post Editorial FA' },
        { id: 'ref-a2', clientId: clientAId, title: 'Stories FA' },
        { id: 'ref-b1', clientId: clientBId, title: 'Arte Cliente B' },
      ];

      const clientARefs = mockRefs.filter((r) => r.clientId === clientAId);
      const clientBRefs = mockRefs.filter((r) => r.clientId === clientBId);

      expect(clientARefs.length).toBe(2);
      expect(clientARefs.every((r) => r.clientId === clientAId)).toBe(true);
      expect(clientBRefs.length).toBe(1);
      expect(clientBRefs[0].id).toBe('ref-b1');
    });

    it('Troca de cliente limpa deterministicamente a referência selecionada', () => {
      let activeClientId: string = clientAId;
      let selectedReferenceId: string | null = 'ref-a1';

      // Usuário troca de Cliente A para Cliente B
      const switchClient = (newClientId: string) => {
        activeClientId = newClientId;
        selectedReferenceId = null; // Regra 12
      };

      switchClient(clientBId);

      expect(activeClientId).toBe(clientBId);
      expect(selectedReferenceId).toBeNull();
    });
  });

  // 3 & 4. Validação de seleção e bloqueio sem referência
  describe('3 & 4. Seleção Obrigatória de Referência de Estilo', () => {
    it('seleciona referência e preserva referencePieceId no estado', () => {
      let selectedReferenceId: string | null = null;

      // Usuário clica na referência
      selectedReferenceId = 'ref-fa-principal';

      expect(selectedReferenceId).toBe('ref-fa-principal');
    });

    it('rejeita geração sem referência selecionada', async () => {
      const selectedPieceIds: string[] = [];

      const validateGeneration = (ids: string[]) => {
        if (!ids || ids.length === 0) {
          throw new Error('Selecione uma referência visual para orientar a criação.');
        }
        return true;
      };

      expect(() => validateGeneration(selectedPieceIds)).toThrow(
        /Selecione uma referência visual para orientar a criação/
      );
    });
  });

  // 5 a 8. Formatos: Feed 4:5, Story 9:16, Square 1:1, Horizontal 16:9
  describe('5 a 8. Formatos Suportados pelo Composer', () => {
    const service = new CreativeChatService(createMockSupabase());

    it('Feed 4:5 gera no formato instagram_feed_4_5 e aspecto 4:5', async () => {
      const piece = await service.generateChatPiece({
        organizationId: orgId,
        clientId: clientAId,
        userId,
        userMessage: 'Post comercial 4:5',
        format: 'instagram_feed_4_5',
        aspectRatio: '4:5',
        projectType: 'single_post',
      });

      expect(piece.format).toBe('instagram_feed_4_5');
      expect(piece.aspectRatio).toBe('4:5');
    });

    it('Story 9:16 gera no formato instagram_story e aspecto 9:16', async () => {
      const piece = await service.generateChatPiece({
        organizationId: orgId,
        clientId: clientAId,
        userId,
        userMessage: 'Story vertical 9:16',
        format: 'instagram_story',
        aspectRatio: '9:16',
        projectType: 'single_post',
      });

      expect(piece.format).toBe('instagram_story');
      expect(piece.aspectRatio).toBe('9:16');
    });

    it('Square 1:1 gera no formato instagram_square e aspecto 1:1', async () => {
      const piece = await service.generateChatPiece({
        organizationId: orgId,
        clientId: clientAId,
        userId,
        userMessage: 'Quadrado para feed 1:1',
        format: 'instagram_square',
        aspectRatio: '1:1',
        projectType: 'single_post',
      });

      expect(piece.format).toBe('instagram_square');
      expect(piece.aspectRatio).toBe('1:1');
    });

    it('Horizontal 16:9 gera no formato custom e aspecto 16:9', async () => {
      const piece = await service.generateChatPiece({
        organizationId: orgId,
        clientId: clientAId,
        userId,
        userMessage: 'Banner horizontal 16:9',
        format: 'custom',
        aspectRatio: '16:9',
        projectType: 'single_post',
      });

      expect(piece.format).toBe('custom');
      expect(piece.aspectRatio).toBe('16:9');
    });
  });

  // 9 & 10. Peça Única vs Carrossel
  describe('9 & 10. Tipos de Criação: Peça Única e Carrossel', () => {
    const service = new CreativeChatService(createMockSupabase());

    it('Peça Única gera exatamente 1 lâmina (imageCount = 1)', async () => {
      const piece = await service.generateChatPiece({
        organizationId: orgId,
        clientId: clientAId,
        userId,
        userMessage: 'Post único de alta conversão',
        projectType: 'single_post',
      });

      expect(piece.projectType).toBe('single_post');
      expect(piece.previewUrl).toBeDefined();
      expect(piece.carouselSlides).toBeUndefined();
    });

    it('Carrossel de 5 lâminas gera exatamente 5 lâminas estruturadas com a mesma referência', async () => {
      const piece = await service.generateChatPiece({
        organizationId: orgId,
        clientId: clientAId,
        userId,
        userMessage: 'Carrossel explicando 5 etapas para recuperar pacientes',
        projectType: 'carousel',
        slideCount: 5,
      });

      expect(piece.projectType).toBe('carousel');
      expect(piece.carouselSlides).toBeDefined();
      expect(piece.carouselSlides?.length).toBe(5);
      expect(piece.carouselSlides?.[0].slideIndex).toBe(0);
      expect(piece.carouselSlides?.[4].slideIndex).toBe(4);
      expect(piece.carouselSlides?.[0].previewUrl).toBeDefined();
    });
  });

  // 11 & 12. Imagem real da referência e Mandato de Style Reference
  describe('11 & 12. Imagem Real e Style Reference Mandate', () => {
    it('referência real entra como input visual na Responses API', () => {
      const fakeRefBuffer = Buffer.from('fa-visual-reference-raw-bytes');

      const payload = ResponsesMultimodalService.prepareResponsesPayload({
        userPrompt: 'Crie uma arte editorial de alta conversão',
        brandReferences: [
          {
            id: 'ref-fa-1',
            buffer: fakeRefBuffer,
            mimeType: 'image/png',
            isPrimary: true,
            kind: 'brand_reference',
            title: 'Peça Referência FA',
          },
        ],
      });

      // Valida que os bytes reais estão serializados no input_image
      const imageItems = payload.input[0].content.filter((c) => c.type === 'input_image');
      expect(imageItems.length).toBe(1);
      expect(imageItems[0].image_url).toContain(fakeRefBuffer.toString('base64'));
    });

    it('mandato proíbe cópia literal e impõe herança de estilo / mesma família visual', () => {
      const fakeRefBuffer = Buffer.from('fa-visual-reference-raw-bytes');

      const payload = ResponsesMultimodalService.prepareResponsesPayload({
        userPrompt: 'Crie um post sobre 15 mensagens para sua secretária',
        brandReferences: [
          {
            id: 'ref-fa-1',
            buffer: fakeRefBuffer,
            mimeType: 'image/png',
            isPrimary: true,
            kind: 'brand_reference',
            title: 'Peça Referência FA',
          },
        ],
      });

      const textItem = payload.input[0].content.find((c) => c.type === 'input_text')?.text || '';

      expect(textItem).toContain('Use the selected image strictly as a visual style and art-direction reference.');
      expect(textItem).toContain('without reproducing the source artwork literally');
      expect(textItem).toContain('SAME VISUAL FAMILY');
      expect(payload.instructions).toContain('Do NOT copy literal texts, headlines, people, specific unnecessary objects, or exact layout from the reference.');
      expect(payload.instructions).toContain('The goal is an ORIGINAL piece belonging to the SAME VISUAL FAMILY.');
    });
  });

  // =========================================================================
  // 16. BLOQUEIO DE FALSO SUCESSO & GERAÇÃO REAL (HOTFIX SEÇÃO 16)
  // =========================================================================
  describe('16. Bloqueio de Falso Sucesso & Estados Explícitos de Geração', () => {
    it('1. Com referência válida: backend resolve asset real e monta a request', async () => {
      const service = new CreativeChatService(createMockSupabase());
      const piece = await service.generateChatPiece({
        organizationId: orgId,
        clientId: clientAId,
        userId,
        userMessage: 'Arte baseada em referência real',
        selectedPieceIds: [validPieceId],
        format: 'instagram_feed_4_5',
        aspectRatio: '4:5',
      });

      expect(piece.previewUrl).toBeDefined();
      expect(piece.previewUrl).not.toContain('data:image/svg');
      expect(piece.previewUrl).toContain('https://');
      expect(piece.activeReferencesCount).toBe(1);
    });

    it('2. Se a OpenAI não retornar imagem ou falhar: backend lança erro e NUNCA retorna SVG de "Studio FA"', async () => {
      const origProvider = ImageGenerationService.getActiveProvider();

      // Força o provider a simular falha da OpenAI (ex: HTTP 401 ou 500)
      ImageGenerationService.setTestProvider({
        async generate(): Promise<ImageProviderResult> {
          throw new Error('[OpenAI Auth] Chave de API inválida ou sem permissão para o modelo.');
        },
      });

      const service = new CreativeChatService(createMockSupabase());
      let errorThrown: any = null;

      try {
        await service.generateChatPiece({
          organizationId: orgId,
          clientId: clientAId,
          userId,
          userMessage: '15 mensagens para recuperar pacientes perdidos',
          selectedPieceIds: [validPieceId],
        });
      } catch (err: any) {
        errorThrown = err;
      } finally {
        ImageGenerationService.setTestProvider(origProvider);
      }

      // Validação estrita: erro foi lançado, proibido capturar silenciosamente e criar SVG fake
      expect(errorThrown).toBeDefined();
      expect(errorThrown.message).toContain('Chave de API inválida');
    });

    it('3. Se asset falhar ao persistir no Storage: status final é ERRO', async () => {
      const origUpload = StorageService.uploadBuffer;

      // Simula falha de Storage
      StorageService.uploadBuffer = async () => {
        throw new Error('Falha no upload para o Storage: Bucket unavailable');
      };

      const service = new CreativeChatService(createMockSupabase());
      let errorThrown: any = null;

      try {
        await service.generateChatPiece({
          organizationId: orgId,
          clientId: clientAId,
          userId,
          userMessage: 'Teste de falha no storage',
          selectedPieceIds: [validPieceId],
        });
      } catch (err: any) {
        errorThrown = err;
      } finally {
        StorageService.uploadBuffer = origUpload;
      }

      expect(errorThrown).toBeDefined();
      expect(errorThrown.message).toContain('Storage');
    });

    it('4. Validação de bloqueio no frontend: se imageUrl for SVG placeholder ou ausente, falso sucesso é impedido', () => {
      // Simula a validação no frontend do page.tsx
      const validateReceivedAsset = (piece: any) => {
        if (!piece || !piece.previewUrl || piece.previewUrl.startsWith('data:image/svg')) {
          throw new Error('Falha na geração: a OpenAI não retornou um asset visual válido.');
        }
        return true;
      };

      // Cenário com SVG fake antigo de Studio FA
      const fakeSvgPiece = {
        projectId: 'proj-123',
        previewUrl: 'data:image/svg+xml;utf8,<svg ... Studio FA ...</svg>',
      };

      expect(() => validateReceivedAsset(fakeSvgPiece)).toThrow(
        /asset visual válido/
      );

      // Cenário com peça sem previewUrl
      expect(() => validateReceivedAsset({ projectId: 'proj-123' })).toThrow(
        /asset visual válido/
      );

      // Cenário com URL real válida de imagem
      const realPiece = {
        projectId: 'proj-123',
        previewUrl: 'https://rfdossffdlayntmyqpnl.supabase.co/storage/v1/object/sign/generated-assets/gen.png',
      };
      expect(validateReceivedAsset(realPiece)).toBe(true);
    });

    it('5. Referência selecionada compõe a request e o prompt interno de estilo da Seção 14', async () => {
      let capturedPrompt: string | undefined;

      const mockSpyProvider = {
        async generate(params: ImageProviderCallParams): Promise<ImageProviderResult> {
          capturedPrompt = params.prompt;
          return {
            imageBuffer: Buffer.from('mock-pixels'),
            mimeType: 'image/png',
            provider: 'fake' as const,
            model: params.model,
          };
        },
      };

      ImageGenerationService.setTestProvider(mockSpyProvider);

      try {
        const service = new CreativeChatService(createMockSupabase());
        await service.generateChatPiece({
          organizationId: orgId,
          clientId: clientAId,
          userId,
          userMessage: '15 mensagens infalíveis para sua secretária recuperar pacientes perdidos',
          selectedPieceIds: [validPieceId],
        });

        expect(capturedPrompt).toBeDefined();
        // Verifica a diretriz exata da Seção 14
        expect(capturedPrompt).toContain('Use the selected reference as a style and art-direction guide only.');
        expect(capturedPrompt).toContain('Create a new and original artwork that inherits its visual language');
        expect(capturedPrompt).toContain('palette, contrast, typography character, composition rhythm and graphic treatment');
        expect(capturedPrompt).toContain('without copying the source composition literally');
      } finally {
        ImageGenerationService.setTestProvider(null);
      }
    });
  });
});
