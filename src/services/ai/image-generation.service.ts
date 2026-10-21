// src/services/ai/image-generation.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/lib/logger';
import { StorageService } from '@/services/storage/storage.service';
import {
  IntegrationService,
  SUPPORTED_IMAGE_MODELS,
  LEGACY_IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL,
} from '@/services/integrations/integration.service';
import { PromptCompiler } from '@/services/ai/prompt-compiler';
import { ImageCompositeService } from '@/services/image/image-composite.service';
import {
  type CreativeContext,
  type GenerationProfileType,
  type GeneratedAsset,
  GENERATION_PROFILES,
  GPT_IMAGE_RESOLUTIONS,
} from '@/types/domain/creative-engine';

export interface ImageProviderCallParams {
  apiKey: string;
  model: string;
  prompt: string;
  width: number;
  height: number;
  quality: 'low' | 'medium' | 'high';
  referenceBuffers?: Array<{ filename: string; buffer: Buffer; mimeType: string }>;
}

export interface ImageProviderResult {
  imageBuffer: Buffer;
  mimeType: string;
  provider: 'openai' | 'fake';
  model: string;
}

export interface ImageGenerationProvider {
  generate(params: ImageProviderCallParams): Promise<ImageProviderResult>;
}

/**
 * Provider real que se comunica com a API oficial da OpenAI (/v1/images/generations e /v1/images/edits).
 * Zero mocks em produção.
 */
export class OpenAIImageProvider implements ImageGenerationProvider {
  async generate(params: ImageProviderCallParams): Promise<ImageProviderResult> {
    const { apiKey, model, prompt, width, height, quality } = params;

    // Proteção central estrita contra modelos legados
    if (LEGACY_IMAGE_MODELS.includes(model as any)) {
      throw new Error(
        `[OpenAIImageProvider] Tentativa proibida de chamada com modelo legado: "${model}". O Studio FA opera exclusivamente com GPT Image.`
      );
    }

    if (!SUPPORTED_IMAGE_MODELS.includes(model as any)) {
      throw new Error(
        `[OpenAIImageProvider] Modelo de imagem não suportado: "${model}". Modelos válidos: ${SUPPORTED_IMAGE_MODELS.join(', ')}.`
      );
    }

    const openAIModel = model;
    const openAIQuality = quality;
    const openAISize = `${width}x${height}`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: openAIModel,
        prompt,
        size: openAISize,
        quality: openAIQuality,
        n: 1,
      }),
    });

    return this.handleOpenAIResponse(response, openAIModel);
  }

  private async handleOpenAIResponse(response: Response, model: string): Promise<ImageProviderResult> {
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let parsedErr: any = {};
      try {
        parsedErr = JSON.parse(errText);
      } catch {}

      const msg = parsedErr?.error?.message || errText || `HTTP ${response.status}`;
      const code = parsedErr?.error?.code || response.status;

      // Tratamento explícito de erros operacionais da OpenAI
      if (response.status === 401 || response.status === 403) {
        throw new Error(`[OpenAI Auth] Chave de API inválida ou sem permissão para o modelo ${model}: ${msg}`);
      }
      if (response.status === 429) {
        throw new Error(`[OpenAI Quota/Rate Limit] Cota excedida ou limite de requisições atingido: ${msg}`);
      }
      if (code === 'content_policy_violation' || msg.includes('moderation') || msg.includes('safety')) {
        throw new Error(`[OpenAI Moderation] Prompt ou referência violou a política de segurança da OpenAI: ${msg}`);
      }

      throw new Error(`[OpenAI Image API] Falha na geração (Status ${response.status}): ${msg}`);
    }

    const data = await response.json();
    const item = data.data?.[0];

    if (!item) {
      throw new Error('[OpenAI Image API] Resposta com sucesso mas sem dados de imagem retornados.');
    }

    if (item.b64_json) {
      const buffer = Buffer.from(item.b64_json, 'base64');
      return {
        imageBuffer: buffer,
        mimeType: 'image/png',
        provider: 'openai',
        model,
      };
    }

    if (item.url) {
      const imgFetch = await fetch(item.url);
      if (!imgFetch.ok) {
        throw new Error(`[OpenAI Image API] Falha ao baixar bytes da imagem da URL fornecida: HTTP ${imgFetch.status}`);
      }
      const arrayBuf = await imgFetch.arrayBuffer();
      return {
        imageBuffer: Buffer.from(arrayBuf),
        mimeType: imgFetch.headers.get('content-type') || 'image/png',
        provider: 'openai',
        model,
      };
    }

    throw new Error('[OpenAI Image API] Formato de saída não reconhecido (nem b64_json nem url).');
  }
}

export interface GenerateSlideVisualInput {
  context: CreativeContext;
  slideId: string;
  projectId: string;
  profile?: GenerationProfileType;
  customPrompt?: string;
  logoBuffer?: Buffer;
  customReferenceBuffers?: Array<{ filename: string; buffer: Buffer; mimeType: string }>;
  subjectPhotoBuffer?: Buffer;
  subjectCutoutBuffer?: Buffer;
  personHandlingMode?: 'preserve_person' | 'inspire_person';
}

export class ImageGenerationService {
  private static testProvider: ImageGenerationProvider | null = null;

  constructor(private readonly supabase: SupabaseClient<any, any, any>) {}

  /**
   * Ponto de injeção exclusivo para testes determinísticos (FakeImageProvider).
   */
  public static setTestProvider(provider: ImageGenerationProvider | null): void {
    this.testProvider = provider;
  }

  public static getActiveProvider(): ImageGenerationProvider {
    return this.testProvider || new OpenAIImageProvider();
  }

  /**
   * Executa a geração completa do background visual de uma lâmina:
   * 1. Resolve credenciais e modelos configurados
   * 2. Baixa bytes reais das referências se existirem
   * 3. Dispara a chamada com anti-text baking estrito
   * 4. Salva a imagem gerada no bucket privado 'generated-assets'
   * 5. Registra o ativo em 'client_assets' com metadados auditáveis
   */
  public async generateSlideVisual(input: GenerateSlideVisualInput): Promise<GeneratedAsset> {
    const { context, slideId, projectId } = input;
    const profileType: GenerationProfileType = input.profile || 'FINAL';
    const profileConfig = GENERATION_PROFILES[profileType];

    Logger.info({
      operation: 'generate_slide_visual',
      organizationId: context.organizationId,
      result: 'started',
      metadata: {
        projectId,
        slideId,
        profile: profileType,
        format: context.format.id,
      },
    });

    // 1. Resolve modelo e API Key
    const integrationService = new IntegrationService(this.supabase);
    const configuredModel = await integrationService.resolveOpenAIModel(context.organizationId, 'image');
    let modelToUse = profileType === 'SMOKE' ? 'gpt-image-2.5-flare' : configuredModel || profileConfig.model;
    if (LEGACY_IMAGE_MODELS.includes(modelToUse as any)) {
      modelToUse = DEFAULT_IMAGE_MODEL;
    }
    const apiKey = await integrationService.resolveOpenAIKey(context.organizationId);

    // 2. Compila prompt com Anti-Text Baking se não fornecido customizado
    const prompt = input.customPrompt || PromptCompiler.compileFromCreativeContext(context).prompt;

    // 3. Resolve dimensões oficiais para GPT Image
    const res = GPT_IMAGE_RESOLUTIONS[context.format.aspectRatio] || {
      generationWidth: context.format.generationWidth,
      generationHeight: context.format.generationHeight,
    };

    // 4. Carrega bytes reais de todas as referências selecionadas na ordem consistente
    let referenceBuffers: Array<{ filename: string; buffer: Buffer; mimeType: string }> = [];
    if (input.customReferenceBuffers && input.customReferenceBuffers.length > 0) {
      referenceBuffers = input.customReferenceBuffers;
    } else if (context.selectedReferences && context.selectedReferences.length > 0) {
      const sortedRefs = [...context.selectedReferences].sort(
        (a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)
      );
      for (const ref of sortedRefs) {
        try {
          const buf = await StorageService.downloadAsBuffer(ref.storageBucket, ref.storagePath);
          const mime = ref.storagePath.endsWith('.jpg') || ref.storagePath.endsWith('.jpeg')
            ? 'image/jpeg'
            : ref.storagePath.endsWith('.webp')
            ? 'image/webp'
            : 'image/png';

          referenceBuffers.push({
            filename: `ref_${ref.pieceId}.png`,
            buffer: buf,
            mimeType: mime,
          });
        } catch (err: any) {
          console.warn(`[ImageGenerationService] Falha ao carregar referência ${ref.pieceId}:`, err?.message);
        }
      }
    }

    // 5. Executa a geração através do provider ativo
    const provider = ImageGenerationService.getActiveProvider();
    const result = await provider.generate({
      apiKey,
      model: modelToUse,
      prompt,
      width: res.generationWidth,
      height: res.generationHeight,
      quality: profileConfig.quality,
      referenceBuffers: referenceBuffers.length > 0 ? referenceBuffers : undefined,
    });

    // 5.1. Quando há Objeto Principal, a imagem já é gerada contendo o sujeito diretamente pela IA (estilo ChatGPT).
    // Opcionalmente, apenas se o modo de sobreposição for explicitamente 'composite_overlay':
    if ((input.personHandlingMode as string) === 'composite_overlay' && (input.subjectCutoutBuffer || input.subjectPhotoBuffer)) {
      result.imageBuffer = await ImageCompositeService.integrateSubject({
        baseArtworkBuffer: result.imageBuffer,
        subjectPhotoBuffer: input.subjectPhotoBuffer,
        subjectCutoutBuffer: input.subjectCutoutBuffer,
        scaleRatio: 0.76,
        verticalAlign: 'bottom',
        horizontalAlign: 'center',
      });
      result.mimeType = 'image/png';
    }

    // 5.2. Se houver logotipo oficial selecionado, sobrepõe com alta fidelidade e canal alpha
    if (input.logoBuffer) {
      result.imageBuffer = await ImageCompositeService.overlayLogo({
        baseImageBuffer: result.imageBuffer,
        logoBuffer: input.logoBuffer,
        position: 'top_left',
        paddingX: 70,
        paddingY: 70,
        maxLogoWidth: 260,
        maxLogoHeight: 90,
      });
      result.mimeType = 'image/png';
    }

    // 6. Persiste a imagem gerada no bucket privado 'generated-assets'
    const uploadRes = await StorageService.uploadBuffer({
      bucket: 'generated-assets',
      organizationId: context.organizationId,
      clientId: context.clientId,
      folder: 'generated',
      originalFilename: `gen_${slideId}.png`,
      buffer: result.imageBuffer,
      mimeType: result.mimeType,
    });

    // 7. Gera Signed URL com validade de 2 horas para visualização no editor
    const signedUrl = await StorageService.createSignedUrl(
      'generated-assets',
      uploadRes.storagePath,
      7200
    );

    // 8. Registra metadados do ativo em 'client_assets'
    const assetRow = {
      organization_id: context.organizationId,
      client_id: context.clientId,
      asset_type: 'generated_image',
      storage_bucket: 'generated-assets',
      storage_path: uploadRes.storagePath,
      original_filename: `visual_background_${slideId}.png`,
      mime_type: result.mimeType,
      file_size_bytes: uploadRes.fileSizeBytes,
      width: res.generationWidth,
      height: res.generationHeight,
      metadata: {
        projectId,
        slideId,
        provider: result.provider,
        model: modelToUse,
        generationProfile: profileType,
        quality: profileConfig.quality,
        promptVersion: PromptCompiler.VERSION,
        status: 'completed',
        referencePieceIds: context.selectedReferences.map((r) => r.pieceId),
        brandDnaVersionId: context.currentDnaVersionId,
      },
    };

    const { data: insertedAsset, error: assetErr } = await this.supabase
      .from('client_assets')
      .insert(assetRow as any)
      .select('id, created_at')
      .single();

    if (assetErr) {
      console.warn('[ImageGenerationService] Falha ao registrar asset em client_assets:', assetErr.message);
    }

    const generatedAsset: GeneratedAsset = {
      id: insertedAsset?.id || crypto.randomUUID(),
      organizationId: context.organizationId,
      clientId: context.clientId,
      projectId,
      slideId,
      storageBucket: 'generated-assets',
      storagePath: uploadRes.storagePath,
      publicOrSignedUrl: signedUrl || uploadRes.storagePath,
      provider: result.provider,
      model: modelToUse,
      generationProfile: profileType,
      quality: profileConfig.quality,
      width: res.generationWidth,
      height: res.generationHeight,
      promptVersion: PromptCompiler.VERSION,
      status: 'completed',
      createdAt: insertedAsset?.created_at || new Date().toISOString(),
    };

    Logger.info({
      operation: 'generate_slide_visual',
      organizationId: context.organizationId,
      result: 'success',
      metadata: {
        assetId: generatedAsset.id,
        storagePath: uploadRes.storagePath,
        model: modelToUse,
      },
    });

    return generatedAsset;
  }
}
