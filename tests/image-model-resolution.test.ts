import fs from 'fs';
import path from 'path';
import { describe, it, expect } from './support/bun-test-shim';
import {
  IntegrationService,
  SUPPORTED_IMAGE_MODELS,
  LEGACY_IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL,
} from '../src/services/integrations/integration.service';
import {
  OpenAIImageProvider,
  ImageGenerationService,
  type ImageProviderCallParams,
  type ImageProviderResult,
} from '../src/services/ai/image-generation.service';
import { StorageService } from '../src/services/storage/storage.service';
import { AI_GENERATION_PRESETS, getPresetDefinition } from '../src/config/presets';
import { GENERATION_PROFILES } from '../src/types/domain/creative-engine';

// Carrega .env.local para testes
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

describe('HOTFIX: Resolução Determinística do Modelo de Imagem & Proteção contra DALL-E', () => {
  // Mock Supabase Factory
  function createMockSupabase(settingsObj: any = null) {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: settingsObj ? { settings: settingsObj } : null,
              }),
            }),
          }),
        }),
        upsert: async () => ({ error: null }),
      }),
    } as any;
  }

  // =========================================================================
  // 1. RESOLUÇÃO DE MODELO (IntegrationService)
  // =========================================================================
  describe('1. IntegrationService.resolveOpenAIModel', () => {
    it('migra automaticamente legado "dall-e-3" do banco para GPT Image padrão', async () => {
      const mockSupabase = createMockSupabase({ imageModel: 'dall-e-3' });
      const service = new IntegrationService(mockSupabase);

      const resolved = await service.resolveOpenAIModel('org-123', 'image');

      expect(resolved).toBe(DEFAULT_IMAGE_MODEL);
      expect(resolved).not.toContain('dall-e');
      expect(SUPPORTED_IMAGE_MODELS).toContain(resolved as any);
    });

    it('migra automaticamente legado "dall-e-2" do banco para GPT Image padrão', async () => {
      const mockSupabase = createMockSupabase({ imageModel: 'dall-e-2' });
      const service = new IntegrationService(mockSupabase);

      const resolved = await service.resolveOpenAIModel('org-123', 'image');

      expect(resolved).toBe(DEFAULT_IMAGE_MODEL);
      expect(resolved).not.toContain('dall-e');
    });

    it('rejeita modelo desconhecido que não seja suportado nem legado com erro administrativo claro', async () => {
      const mockSupabase = createMockSupabase({ imageModel: 'midjourney-v7' });
      const service = new IntegrationService(mockSupabase);

      let thrownError: Error | null = null;
      try {
        await service.resolveOpenAIModel('org-123', 'image');
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain('Modelo de imagem não suportado: "midjourney-v7"');
      expect(thrownError?.message).toContain('gpt-image-2.5-flare');
      expect(thrownError?.message).toContain('gpt-image-2.5-sunburst');
    });

    it('aceita e preserva modelo oficial suportado configurado no banco (gpt-image-2.5-flare)', async () => {
      const mockSupabase = createMockSupabase({ imageModel: 'gpt-image-2.5-flare' });
      const service = new IntegrationService(mockSupabase);

      const resolved = await service.resolveOpenAIModel('org-123', 'image');
      expect(resolved).toBe('gpt-image-2.5-flare');
    });

    it('aceita e preserva modelo oficial suportado configurado no banco (gpt-image-2.5-sunburst)', async () => {
      const mockSupabase = createMockSupabase({ imageModel: 'gpt-image-2.5-sunburst' });
      const service = new IntegrationService(mockSupabase);

      const resolved = await service.resolveOpenAIModel('org-123', 'image');
      expect(resolved).toBe('gpt-image-2.5-sunburst');
    });

    it('utiliza fallback seguro se OPENAI_IMAGE_MODEL no env for dall-e-3 legado', async () => {
      const oldEnv = process.env.OPENAI_IMAGE_MODEL;
      try {
        process.env.OPENAI_IMAGE_MODEL = 'dall-e-3';
        const mockSupabase = createMockSupabase(null);
        const service = new IntegrationService(mockSupabase);

        const resolved = await service.resolveOpenAIModel('org-123', 'image');
        expect(resolved).toBe(DEFAULT_IMAGE_MODEL);
        expect(resolved).not.toContain('dall-e');
      } finally {
        process.env.OPENAI_IMAGE_MODEL = oldEnv;
      }
    });
  });

  // =========================================================================
  // 2. PROTEÇÃO CENTRAL CONTRA MODELO RETIRADO (OpenAIImageProvider)
  // =========================================================================
  describe('2. OpenAIImageProvider Proteção Central', () => {
    const provider = new OpenAIImageProvider();

    it('bloqueia estritamente tentativa de envio de "dall-e-3" sem bater na rede', async () => {
      let errorThrown: Error | null = null;
      try {
        await provider.generate({
          apiKey: 'sk-dummy-test-key',
          model: 'dall-e-3',
          prompt: 'test prompt',
          width: 1024,
          height: 1024,
          quality: 'high',
        });
      } catch (err: any) {
        errorThrown = err;
      }

      expect(errorThrown).toBeDefined();
      expect(errorThrown?.message).toContain('Tentativa proibida de chamada com modelo legado: "dall-e-3"');
    });

    it('bloqueia estritamente tentativa de envio de "dall-e-2" sem bater na rede', async () => {
      let errorThrown: Error | null = null;
      try {
        await provider.generate({
          apiKey: 'sk-dummy-test-key',
          model: 'dall-e-2',
          prompt: 'test prompt',
          width: 1024,
          height: 1024,
          quality: 'low',
        });
      } catch (err: any) {
        errorThrown = err;
      }

      expect(errorThrown).toBeDefined();
      expect(errorThrown?.message).toContain('Tentativa proibida de chamada com modelo legado: "dall-e-2"');
    });

    it('bloqueia modelo desconhecido não suportado', async () => {
      let errorThrown: Error | null = null;
      try {
        await provider.generate({
          apiKey: 'sk-dummy-test-key',
          model: 'stable-diffusion-xl',
          prompt: 'test prompt',
          width: 1024,
          height: 1024,
          quality: 'medium',
        });
      } catch (err: any) {
        errorThrown = err;
      }

      expect(errorThrown).toBeDefined();
      expect(errorThrown?.message).toContain('Modelo de imagem não suportado: "stable-diffusion-xl"');
    });
  });

  // =========================================================================
  // 3. PRESETS E REQUEST BUILDER COM SPIED PROVIDER (Zero OpenAI Cost)
  // =========================================================================
  describe('3. Presets & Request Builder (Zero Chamadas OpenAI)', () => {
    it('Preset Rápido está configurado para gpt-image-2.5-flare', () => {
      const fastPreset = getPresetDefinition('fast');
      expect(fastPreset.model).toBe('gpt-image-2.5-flare');
      expect(fastPreset.quality).toBe('low');
      expect(fastPreset.model).not.toContain('dall-e');
    });

    it('Preset Produção está configurado para gpt-image-2.5-sunburst', () => {
      const prodPreset = getPresetDefinition('production');
      expect(prodPreset.model).toBe('gpt-image-2.5-sunburst');
      expect(prodPreset.quality).toBe('high');
      expect(prodPreset.model).not.toContain('dall-e');
    });

    it('Preset Premium está configurado para gpt-image-2.5-sunburst', () => {
      const premPreset = getPresetDefinition('premium');
      expect(premPreset.model).toBe('gpt-image-2.5-sunburst');
      expect(premPreset.quality).toBe('high');
      expect(premPreset.model).not.toContain('dall-e');
    });

    it('Nenhum preset do Studio FA faz referência a DALL-E', () => {
      const allPresets = Object.values(AI_GENERATION_PRESETS);
      for (const p of allPresets) {
        expect(p.model).not.toContain('dall-e');
        expect(p.name).not.toContain('DALL-E');
      }
    });

    it('ImageGenerationService envia gpt-image-2.5-flare no perfil SMOKE', async () => {
      let interceptedCall: ImageProviderCallParams | null = null;

      // Mock test provider (Zero OpenAI network calls)
      const mockProvider = {
        async generate(params: ImageProviderCallParams): Promise<ImageProviderResult> {
          interceptedCall = params;
          return {
            imageBuffer: Buffer.from('fake-png-bytes'),
            mimeType: 'image/png',
            provider: 'fake',
            model: params.model,
          };
        },
      };

      ImageGenerationService.setTestProvider(mockProvider);

      try {
        const mockSupabase = {
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => {
                    if (table === 'integration_credentials') {
                      return { data: null };
                    }
                    if (table === 'integration_settings') {
                      return { data: { settings: { imageModel: 'gpt-image-2.5-sunburst' } } };
                    }
                    return { data: null };
                  },
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'asset-test-1',
                    organization_id: 'org-test',
                    client_id: 'client-test',
                    storage_bucket: 'generated-assets',
                    storage_path: 'generated/test.png',
                    asset_type: 'background',
                    width: 1024,
                    height: 1280,
                    file_size_bytes: 100,
                    mime_type: 'image/png',
                    created_at: new Date().toISOString(),
                    metadata: {},
                  },
                  error: null,
                }),
              }),
            }),
          }),
          storage: {
            from: () => ({
              upload: async () => ({ data: { path: 'generated/test.png' }, error: null }),
              createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/signed.png' }, error: null }),
            }),
          },
        } as any;

        const service = new ImageGenerationService(mockSupabase);

        const dummyContext: any = {
          organizationId: 'org-test',
          clientId: 'client-test',
          clientName: 'Test Brand',
          projectId: 'project-test',
          slideIndex: 1,
          format: {
            id: 'instagram_feed_4_5',
            name: 'Instagram Feed 4:5',
            aspectRatio: '4:5',
            generationWidth: 1024,
            generationHeight: 1280,
            canvasWidth: 1080,
            canvasHeight: 1350,
          },
          exactContent: {
            title: 'Test Headline',
            subtitle: 'Test Subtitle',
          },
          manualRules: [],
          compactBrandContext: {
            mood: ['Sophisticated'],
            palette: {
              primary: ['#000000'],
              secondary: ['#FFFFFF'],
              accent: ['#CEF52A'],
              background: ['#111111'],
            },
            typographyCharacter: 'Clean and modern',
            imagery: {},
            doRules: [],
          },
          brandAssets: {
            primaryColor: '#000000',
          },
          selectedReferences: [],
        };

        process.env.OPENAI_API_KEY = 'sk-mock-for-testing';

        const origUpload = StorageService.uploadBuffer;
        (StorageService as any).uploadBuffer = async () => ({
          path: 'generated/test.png',
          fullPath: 'generated-assets/generated/test.png',
          signedUrl: 'https://example.com/signed.png',
          publicUrl: 'https://example.com/public.png',
          storageBucket: 'generated-assets',
          storagePath: 'generated/test.png',
          mimeType: 'image/png',
          fileSizeBytes: 100,
        });

        try {
          await service.generateSlideVisual({
            context: dummyContext,
            slideId: 'slide-123',
            projectId: 'project-test',
            profile: 'SMOKE',
          });

          expect(interceptedCall).toBeDefined();
          expect((interceptedCall as any)?.model).toBe('gpt-image-2.5-flare');
          expect((interceptedCall as any)?.model).not.toContain('dall-e');
          expect((interceptedCall as any)?.quality).toBe('low');
        } finally {
          StorageService.uploadBuffer = origUpload;
        }
      } finally {
        ImageGenerationService.setTestProvider(null);
      }
    });

    it('ImageGenerationService envia gpt-image-2.5-sunburst no perfil FINAL', async () => {
      let interceptedCall: ImageProviderCallParams | null = null;

      const mockProvider = {
        async generate(params: ImageProviderCallParams): Promise<ImageProviderResult> {
          interceptedCall = params;
          return {
            imageBuffer: Buffer.from('fake-png-bytes'),
            mimeType: 'image/png',
            provider: 'fake',
            model: params.model,
          };
        },
      };

      ImageGenerationService.setTestProvider(mockProvider);

      try {
        const mockSupabase = {
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => {
                    if (table === 'integration_credentials') {
                      return { data: null };
                    }
                    if (table === 'integration_settings') {
                      return { data: { settings: { imageModel: 'gpt-image-2.5-sunburst' } } };
                    }
                    return { data: null };
                  },
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'asset-test-2',
                    organization_id: 'org-test',
                    client_id: 'client-test',
                    storage_bucket: 'generated-assets',
                    storage_path: 'generated/test2.png',
                    asset_type: 'background',
                    width: 1024,
                    height: 1280,
                    file_size_bytes: 100,
                    mime_type: 'image/png',
                    created_at: new Date().toISOString(),
                    metadata: {},
                  },
                  error: null,
                }),
              }),
            }),
          }),
          storage: {
            from: () => ({
              upload: async () => ({ data: { path: 'generated/test2.png' }, error: null }),
              createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/signed.png' }, error: null }),
            }),
          },
        } as any;

        const service = new ImageGenerationService(mockSupabase);

        const dummyContext: any = {
          organizationId: 'org-test',
          clientId: 'client-test',
          clientName: 'Test Brand',
          projectId: 'project-test',
          slideIndex: 1,
          format: {
            id: 'instagram_feed_4_5',
            name: 'Instagram Feed 4:5',
            aspectRatio: '4:5',
            generationWidth: 1024,
            generationHeight: 1280,
            canvasWidth: 1080,
            canvasHeight: 1350,
          },
          exactContent: {
            title: 'Final Headline',
            subtitle: 'Final Subtitle',
          },
          manualRules: [],
          compactBrandContext: {
            mood: ['Sophisticated'],
            palette: {
              primary: ['#000000'],
              secondary: ['#FFFFFF'],
              accent: ['#CEF52A'],
              background: ['#111111'],
            },
            typographyCharacter: 'Clean and modern',
            imagery: {},
            doRules: [],
          },
          brandAssets: {
            primaryColor: '#000000',
          },
          selectedReferences: [],
        };

        process.env.OPENAI_API_KEY = 'sk-mock-for-testing';

        const origUpload = StorageService.uploadBuffer;
        (StorageService as any).uploadBuffer = async () => ({
          path: 'generated/test2.png',
          fullPath: 'generated-assets/generated/test2.png',
          signedUrl: 'https://example.com/signed.png',
          publicUrl: 'https://example.com/public.png',
          storageBucket: 'generated-assets',
          storagePath: 'generated/test2.png',
          mimeType: 'image/png',
          fileSizeBytes: 100,
        });

        try {
          await service.generateSlideVisual({
            context: dummyContext,
            slideId: 'slide-123',
            projectId: 'project-test',
            profile: 'FINAL',
          });

          expect(interceptedCall).toBeDefined();
          expect((interceptedCall as any)?.model).toBe('gpt-image-2.5-sunburst');
          expect((interceptedCall as any)?.model).not.toContain('dall-e');
          expect((interceptedCall as any)?.quality).toBe('high');
        } finally {
          StorageService.uploadBuffer = origUpload;
        }
      } finally {
        ImageGenerationService.setTestProvider(null);
      }
    });
  });
});
