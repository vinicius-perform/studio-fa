// tests/creative-chat-core.test.ts
import { describe, it, expect } from './support/bun-test-shim';
import { randomUUID } from 'node:crypto';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';
import {
  VisualAnalysisReportSchema,
  InterpretedCreativeIntentSchema,
} from '../src/types/domain/creative-chat';
import { canCreateProjects, isAdmin, isOwner, canWriteData } from '../src/lib/auth/permissions';
import { ExportService } from '../src/services/export/export.service';
import { devStore } from '../src/lib/dev-store';
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

describe('MVP 2.1 — Chat Criativo como Núcleo Único de Criação', () => {
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
                  ...(Array.isArray(data) ? data[0] : data),
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
            return { data: { id: randomUUID() }, error: null };
          },
          then: (resolve: any) => resolve({ data: [] }),
        };
        return queryBuilder;
      },
    } as any;
  }

  // 1. Nova Conversa & Client Access
  describe('1. Ciclo de Vida da Conversa & Acesso', () => {
    it('cria e persiste uma nova conversa associada ao cliente', () => {
      const conv = devStore.saveCreativeConversation({
        organization_id: validOrgId,
        client_id: validClientId,
        user_id: validUserId,
        title: 'Campanha Black Friday 2026',
      });

      expect(conv.id).toBeDefined();
      expect(conv.client_id).toBe(validClientId);
      expect(conv.title).toBe('Campanha Black Friday 2026');

      const loaded = devStore.getCreativeConversation(conv.id);
      expect(loaded?.id).toBe(conv.id);
    });

    it('valida regras de acesso RBAC no isolamento de cliente e criação', () => {
      // Admin / Owner tem acesso administrativo
      expect(isAdmin('owner')).toBe(true);
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('designer')).toBe(false);

      // Designer pode criar artes e projetos
      expect(canCreateProjects('designer')).toBe(true);
      expect(canWriteData('designer')).toBe(true);

      // Viewer tem acesso estritamente somente-leitura
      expect(canCreateProjects('viewer')).toBe(false);
      expect(canWriteData('viewer')).toBe(false);
    });
  });

  // 2. Persistência de Mensagens & Continuidade Multi-Turn (previous_response_id)
  describe('2. Mensagens, Anexos & Continuidade Multi-Turn', () => {
    it('persiste mensagens da conversa e atualiza last_response_id', () => {
      const conv = devStore.saveCreativeConversation({
        organization_id: validOrgId,
        client_id: validClientId,
        user_id: validUserId,
        title: 'Nova Conversa IA',
      });

      const userMsg = devStore.addCreativeMessage({
        conversation_id: conv.id,
        role: 'user',
        content: 'Crie um post 4:5 com headline: "Revolução da IA"',
      });

      expect(userMsg.id).toBeDefined();
      expect(userMsg.content).toContain('Revolução da IA');

      // Resposta da IA com response_id para continuidade multi-turn
      const responseId = 'resp_openai_abc123';
      const aiMsg = devStore.addCreativeMessage({
        conversation_id: conv.id,
        role: 'assistant',
        content: 'Aqui está a arte gerada com a identidade de Fazendo Acontecer.',
        response_id: responseId,
        metadata: {
          generatedPiece: {
            previewUrl: 'https://storage.supabase.co/v1/object/public/generated-assets/test.png',
            aspectRatio: '4:5',
          },
        },
      });

      expect(aiMsg.response_id).toBe(responseId);

      const convUpdated = devStore.getCreativeConversation(conv.id);
      expect(convUpdated?.last_response_id).toBe(responseId);

      const history = devStore.listCreativeMessages(conv.id);
      expect(history.length).toBe(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('suporta múltiplos anexos e print de layout como base de estrutura', () => {
      const service = new CreativeChatService(createMockSupabase());
      const intent = service.interpretCreativePrompt(
        'Use esse print como estrutura e crie um post 4:5 com a headline "Dominando o Funil"',
        'https://storage.supabase.co/v1/object/public/client-pieces/print.png'
      );

      expect(intent.aspectRatio).toBe('4:5');
      expect(intent.headline).toBe('Dominando o Funil');
      expect(intent.useLayoutPrintAsStructure).toBe(true);
    });
  });

  // 3. Análise Visual Estruturada
  describe('3. Leitura e Análise Visual da Marca', () => {
    it('produz relatório de 5 seções estruturado com o Brand DNA da marca', async () => {
      const service = new CreativeChatService(createMockSupabase());
      const report = await service.analyzeVisualMemory({
        organizationId: validOrgId,
        clientId: validClientId,
        selectedPieceIds: ['piece-1', 'piece-2'],
      });

      expect(report.concept).toBeDefined();
      expect(report.colorPalette.length).toBeGreaterThanOrEqual(3);
      expect(report.predominantStyles.length).toBe(3);
      expect(report.recognizableFeatures.length).toBeGreaterThanOrEqual(4);
      expect(report.guidelines.keep.length).toBeGreaterThanOrEqual(4);
      expect(report.guidelines.avoid.length).toBeGreaterThanOrEqual(4);
      expect(report.artDirectionReview.consistencyScore).toBeGreaterThanOrEqual(80);
    });
  });

  // 4. Geração de Arte Completa (sem Konva, sem layers separadas)
  describe('4. Geração de Arte Completa & Refinamento por Conversa', () => {
    it('gera arte completa unificada com texto integrado e persistência imediata', async () => {
      const service = new CreativeChatService(createMockSupabase());

      const piece = await service.generateChatPiece({
        organizationId: validOrgId,
        clientId: validClientId,
        userId: validUserId,
        userMessage: 'Gere um post 4:5 com headline: "Como acelerar seus resultados com IA"',
      });

      expect(piece.previewUrl).toBeDefined();
      expect(piece.aspectRatio).toBe('4:5');
      expect(piece.headline).toBe('Como acelerar seus resultados com IA');
      expect(piece.layersCount).toBe(1); // Arte unificada sem camadas manuais
    });

    it('interpreta refinamentos conversacionais (deixe mais premium, mude estilo)', () => {
      const service = new CreativeChatService(createMockSupabase());
      const intent1 = service.interpretCreativePrompt('Deixe a composição mais clean');
      expect(intent1.visualStyle).toContain('clean');

      const intent2 = service.interpretCreativePrompt('Faça uma versão futurista com iluminação neon');
      expect(intent2.visualStyle).toContain('Futurista');
    });
  });

  // 5. Download Direto & Salvar em Produções
  describe('5. Download Direto & Salvar em Produções', () => {
    it('formata nomes de download padronizados para exportação direta', () => {
      const filename = ExportService.formatFilename({
        clientSlug: 'Fazendo Acontecer',
        dateStr: '2026-10-20',
        slideIndex: 0,
        ext: 'png',
      });
      expect(filename).toBe('fazendo-acontecer_2026-10-20_slide-01.png');
    });

    it('salva arte gerada como produção vinculada à conversa', () => {
      const projId = 'prod-test-123';
      const prod = devStore.createProject({
        id: projId,
        organization_id: validOrgId,
        client_id: validClientId,
        name: 'Post IA — Como Acelerar',
        title: 'Post IA — Como Acelerar',
        format: '4:5',
        status: 'draft',
        thumbnail_url: 'https://storage.supabase.co/test.png',
        conversation_id: 'conv-123',
      });

      expect(prod.id).toBe(projId);
      expect(prod.thumbnail_url).toBe('https://storage.supabase.co/test.png');
      expect(prod.conversation_id).toBe('conv-123');

      const loaded = devStore.getProject(projId);
      expect(loaded?.name).toBe('Post IA — Como Acelerar');
    });
  });
});
