// src/services/integrations/integration.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/crypto';
import { getServerEnv } from '@/config/env';

export const SUPPORTED_IMAGE_MODELS = [
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const;

export type SupportedImageModel = (typeof SUPPORTED_IMAGE_MODELS)[number];

export const LEGACY_IMAGE_MODELS = ['dall-e-3', 'dall-e-2', 'dall-e'] as const;

export const DEFAULT_IMAGE_MODEL: SupportedImageModel = 'gpt-image-2.5-sunburst';

export interface IntegrationPublicInfo {
  provider: string;
  configured: boolean;
  maskedSecret?: string;
  status: 'connected' | 'unconfigured' | 'error';
  lastTestedAt?: string | null;
  settings?: Record<string, any>;
}

export interface SupabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'unreachable';
  projectRef: string;
  database: boolean;
  auth: boolean;
  storage: boolean;
  checkedAt: string;
  error?: string;
}

export class IntegrationService {
  constructor(private supabase: any) {}

  /**
   * Obtém as credenciais e configurações públicas (mascaradas) de um provedor para a organização.
   */
  async getProviderInfo(organizationId: string, provider: string): Promise<IntegrationPublicInfo> {
    const { data: cred } = await this.supabase
      .from('integration_credentials')
      .select('secret_last_four, status, last_tested_at')
      .eq('organization_id', organizationId)
      .eq('provider', provider)
      .maybeSingle();

    const { data: settingsRow } = await this.supabase
      .from('integration_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .eq('provider', provider)
      .maybeSingle();

    if (cred) {
      return {
        provider,
        configured: true,
        maskedSecret: maskSecret(cred.secret_last_four, provider === 'openai' ? 'sk-proj' : 'secret'),
        status: cred.status,
        lastTestedAt: cred.last_tested_at,
        settings: (settingsRow?.settings as Record<string, any>) || {},
      };
    }

    // Se não estiver no banco, verifica se há fallback no ambiente
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const envKey = process.env.OPENAI_API_KEY;
      const lastFour = envKey.slice(-4);
      return {
        provider: 'openai',
        configured: true,
        maskedSecret: maskSecret(lastFour, 'sk-env'),
        status: 'connected',
        lastTestedAt: null,
        settings: {
          textModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
          visionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
          imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare',
        },
      };
    }

    return {
      provider,
      configured: false,
      status: 'unconfigured',
      settings: (settingsRow?.settings as Record<string, any>) || {},
    };
  }

  /**
   * Salva a API key criptografada no banco da organização.
   */
  async saveApiKey(
    organizationId: string,
    provider: string,
    rawApiKey: string,
    configuredBy: string
  ): Promise<IntegrationPublicInfo> {
    const trimmedKey = rawApiKey.trim();
    if (!trimmedKey) {
      throw new Error('Chave de API não pode ser vazia.');
    }

    const { encryptedSecret, lastFour } = encryptSecret(trimmedKey);

    const { error: upsertErr } = await this.supabase
      .from('integration_credentials')
      .upsert(
        {
          organization_id: organizationId,
          provider,
          encrypted_secret: encryptedSecret,
          secret_last_four: lastFour,
          status: 'connected',
          configured_by: configuredBy,
          updated_at: new Date().toISOString(),
          last_tested_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,provider' }
      );

    if (upsertErr) {
      throw new Error(`Erro ao persistir credencial: ${upsertErr.message}`);
    }

    return this.getProviderInfo(organizationId, provider);
  }

  /**
   * Atualiza as configurações adicionais do provedor (ex: modelos de IA).
   */
  async saveSettings(organizationId: string, provider: string, settings: Record<string, any>) {
    const { error } = await this.supabase.from('integration_settings').upsert(
      {
        organization_id: organizationId,
        provider,
        settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,provider' }
    );

    if (error) {
      throw new Error(`Erro ao salvar configurações de integração: ${error.message}`);
    }
  }

  /**
   * Remove a integração da organização.
   */
  async removeIntegration(organizationId: string, provider: string): Promise<void> {
    await this.supabase
      .from('integration_credentials')
      .delete()
      .eq('organization_id', organizationId)
      .eq('provider', provider);

    await this.supabase
      .from('integration_settings')
      .delete()
      .eq('organization_id', organizationId)
      .eq('provider', provider);
  }

  /**
   * Testa a conectividade com a API da OpenAI.
   */
  async testOpenAI(organizationId: string, explicitKey?: string): Promise<{ success: boolean; message: string }> {
    let keyToTest = explicitKey?.trim();

    if (!keyToTest) {
      keyToTest = await this.resolveOpenAIKey(organizationId);
    }

    try {
      const resp = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${keyToTest}`,
        },
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP ${resp.status}`);
      }

      // Atualiza o status no banco se já estiver salvo
      await this.supabase
        .from('integration_credentials')
        .update({
          status: 'connected',
          last_tested_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId)
        .eq('provider', 'openai');

      return { success: true, message: 'OpenAI conectada com sucesso!' };
    } catch (err: any) {
      await this.supabase
        .from('integration_credentials')
        .update({
          status: 'error',
          last_tested_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId)
        .eq('provider', 'openai');

      const msg = err?.message || 'Falha ao autenticar na OpenAI.';
      return { success: false, message: `Erro de validação: ${msg}` };
    }
  }

  /**
   * Resolve a chave da OpenAI na seguinte ordem:
   * 1. Chave configurada no banco para a organização (descriptografada)
   * 2. Variável de ambiente OPENAI_API_KEY
   * 3. Erro (integração não configurada)
   */
  async resolveOpenAIKey(organizationId: string): Promise<string> {
    const { data: cred } = await this.supabase
      .from('integration_credentials')
      .select('encrypted_secret')
      .eq('organization_id', organizationId)
      .eq('provider', 'openai')
      .maybeSingle();

    if (cred?.encrypted_secret) {
      try {
        return decryptSecret(cred.encrypted_secret);
      } catch (err) {
        console.error('Falha ao descriptografar credencial OpenAI:', err);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY;
    }

    throw new Error('Integração OpenAI não configurada. Configure na tela de Integrações ou via variável de ambiente.');
  }

  /**
   * Resolve o modelo operacional da OpenAI para a organização na seguinte ordem:
   * 1. integration_settings da organização (settings.visionModel / settings.textModel / settings.imageModel)
   * 2. Variável de ambiente (OPENAI_VISION_MODEL / OPENAI_IMAGE_MODEL)
   * 3. Fallback de modelo server-side
   */
  async resolveOpenAIModel(organizationId: string, modelType: 'vision' | 'text' | 'image' = 'vision'): Promise<string> {
    const { data: settingsRow } = await this.supabase
      .from('integration_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .eq('provider', 'openai')
      .maybeSingle();

    const settings = (settingsRow?.settings as Record<string, any>) || {};

    if (modelType === 'vision' && settings.visionModel && typeof settings.visionModel === 'string' && settings.visionModel.trim()) {
      return settings.visionModel.trim();
    }
    if (modelType === 'text' && settings.textModel && typeof settings.textModel === 'string' && settings.textModel.trim()) {
      return settings.textModel.trim();
    }

    if (modelType === 'image') {
      const rawModel = typeof settings.imageModel === 'string' ? settings.imageModel.trim() : '';

      if (rawModel) {
        // 1. Intercepta modelo legado conhecido
        if (LEGACY_IMAGE_MODELS.includes(rawModel as any)) {
          console.warn(
            `[IntegrationService] Modelo legado detectado: "${rawModel}". Migrando automaticamente para ${DEFAULT_IMAGE_MODEL}.`
          );
          // Migração assíncrona segura no banco para auto-reparo
          this.saveSettings(organizationId, 'openai', { ...settings, imageModel: DEFAULT_IMAGE_MODEL }).catch((err) => {
            console.error('[IntegrationService] Falha ao persistir auto-migração de modelo no banco:', err?.message);
          });
          return DEFAULT_IMAGE_MODEL;
        }

        // 2. Modelo suportado oficial
        if (SUPPORTED_IMAGE_MODELS.includes(rawModel as any)) {
          return rawModel;
        }

        // 3. Modelo desconhecido não homologado -> erro administrativo claro
        throw new Error(
          `[IntegrationService] Modelo de imagem não suportado: "${rawModel}". Modelos válidos: ${SUPPORTED_IMAGE_MODELS.join(', ')}.`
        );
      }

      // 4. Fallback de variáveis server-side
      const envModel = process.env.OPENAI_IMAGE_MODEL?.trim();
      if (envModel) {
        if (LEGACY_IMAGE_MODELS.includes(envModel as any)) {
          console.warn(
            `[IntegrationService] OPENAI_IMAGE_MODEL de ambiente possui modelo legado "${envModel}". Usando fallback seguro: ${DEFAULT_IMAGE_MODEL}.`
          );
          return DEFAULT_IMAGE_MODEL;
        }
        if (SUPPORTED_IMAGE_MODELS.includes(envModel as any)) {
          return envModel;
        }
        throw new Error(
          `[IntegrationService] OPENAI_IMAGE_MODEL de ambiente inválido: "${envModel}". Modelos válidos: ${SUPPORTED_IMAGE_MODELS.join(', ')}.`
        );
      }

      return DEFAULT_IMAGE_MODEL;
    }

    // Fallback de variáveis server-side para vision / text
    if (modelType === 'vision' || modelType === 'text') {
      return process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o';
    }

    return 'gpt-4o';
  }

  /**
   * Verifica a saúde da conexão com o Supabase sem expor segredos.
   */
  static async checkSupabaseHealth(supabase: any): Promise<SupabaseHealthStatus> {
    const env = getServerEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRefMatch = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
    const projectRef = projectRefMatch ? projectRefMatch[1] : 'rfdossffdlayntmyqpnl';

    let dbOk = false;
    let authOk = false;
    let storageOk = false;
    let errorDetail: string | undefined;

    try {
      // 1. Testa banco
      const { error: dbErr } = await supabase.from('organizations').select('id').limit(1);
      dbOk = !dbErr;
      if (dbErr) errorDetail = dbErr.message;
    } catch (e: any) {
      errorDetail = e?.message || 'Falha de rede ao conectar no PostgreSQL';
    }

    try {
      // 2. Testa Auth
      const { error: authErr } = await supabase.auth.getSession();
      authOk = !authErr;
    } catch {
      authOk = false;
    }

    try {
      // 3. Testa Storage
      const { error: storageErr } = await supabase.storage.listBuckets();
      storageOk = !storageErr;
    } catch {
      storageOk = false;
    }

    const allOk = dbOk && authOk;
    const partialOk = dbOk || authOk || storageOk;

    return {
      status: allOk ? 'healthy' : partialOk ? 'degraded' : 'unreachable',
      projectRef,
      database: dbOk,
      auth: authOk,
      storage: storageOk,
      checkedAt: new Date().toISOString(),
      error: errorDetail,
    };
  }
}
