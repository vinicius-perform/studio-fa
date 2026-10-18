// src/services/storage/storage.service.ts
import { getServiceRoleClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface StorageUploadResult {
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface Base64UploadInput {
  bucket: 'client-brand-assets' | 'client-pieces' | 'custom-fonts';
  organizationId: string;
  clientId: string;
  folder: 'logos' | 'pieces' | 'fonts' | 'references';
  originalFilename: string;
  base64Data: string; // pode ser data URL "data:image/png;base64,..." ou pura
  mimeType?: string;
}

export class StorageService {
  /**
   * Converte Data URL ou Base64 para Buffer seguro com detecção de mimeType.
   */
  public static parseDataUrl(input: string, fallbackMime = 'image/png'): { buffer: Buffer; mimeType: string } {
    let cleanMime = fallbackMime;
    let base64Content = input;

    if (input.startsWith('data:')) {
      const match = input.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        cleanMime = match[1];
        base64Content = match[2];
      }
    }

    const buffer = Buffer.from(base64Content, 'base64');
    return { buffer, mimeType: cleanMime };
  }

  /**
   * Determina extensão de arquivo a partir do mimeType.
   */
  public static getExtensionForMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'font/ttf': 'ttf',
      'font/otf': 'otf',
      'font/woff': 'woff',
      'font/woff2': 'woff2',
      'application/x-font-ttf': 'ttf',
      'application/x-font-otf': 'otf',
      'application/font-woff': 'woff',
      'application/font-woff2': 'woff2',
    };
    return map[mimeType.toLowerCase()] || 'bin';
  }

  /**
   * Salva arquivo no Supabase Storage a partir de Base64 / Data URL.
   * NUNCA salva Base64 no banco de dados.
   */
  public static async uploadBase64(input: Base64UploadInput): Promise<StorageUploadResult> {
    const { buffer, mimeType } = this.parseDataUrl(input.base64Data, input.mimeType || 'image/png');
    const ext = this.getExtensionForMime(mimeType);
    const fileUuid = crypto.randomUUID();
    const safeStoragePath = `${input.organizationId}/${input.clientId}/${input.folder}/${fileUuid}.${ext}`;

    const supabase = getServiceRoleClient();
    const { error } = await supabase.storage
      .from(input.bucket)
      .upload(safeStoragePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Falha no upload para o Supabase Storage (${input.bucket}): ${error.message}`);
    }

    return {
      storageBucket: input.bucket,
      storagePath: safeStoragePath,
      mimeType,
      fileSizeBytes: buffer.length,
    };
  }

  /**
   * Salva arquivo a partir de um Buffer bruto.
   */
  public static async uploadBuffer(params: {
    bucket: 'client-brand-assets' | 'client-pieces' | 'custom-fonts';
    organizationId: string;
    clientId: string;
    folder: 'logos' | 'pieces' | 'fonts' | 'references';
    originalFilename: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StorageUploadResult> {
    const ext = this.getExtensionForMime(params.mimeType);
    const fileUuid = crypto.randomUUID();
    const safeStoragePath = `${params.organizationId}/${params.clientId}/${params.folder}/${fileUuid}.${ext}`;

    const supabase = getServiceRoleClient();
    const { error } = await supabase.storage
      .from(params.bucket)
      .upload(safeStoragePath, params.buffer, {
        contentType: params.mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Falha no upload para o Storage (${params.bucket}): ${error.message}`);
    }

    return {
      storageBucket: params.bucket,
      storagePath: safeStoragePath,
      mimeType: params.mimeType,
      fileSizeBytes: params.buffer.length,
    };
  }

  /**
   * Gera URL assinada com expiração controlada para visualização segura.
   */
  public static async createSignedUrl(
    bucket: string,
    storagePath: string,
    expiresInSeconds = 3600
  ): Promise<string | null> {
    if (!storagePath) return null;

    // Se já for uma URL HTTP válida (ex: externa), retorna ela própria
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return storagePath;
    }

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        console.warn(`[StorageService] Não foi possível gerar signed URL para ${bucket}/${storagePath}:`, error?.message);
        return null;
      }

      return data.signedUrl;
    } catch (err: any) {
      console.warn(`[StorageService] Erro ao criar signed URL:`, err?.message);
      return null;
    }
  }

  /**
   * Baixa o arquivo do Storage e retorna o Buffer.
   * Utilizado para alimentar a IA Vision diretamente com os bytes reais da imagem.
   */
  public static async downloadAsBuffer(bucket: string, storagePath: string): Promise<Buffer> {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);

    if (error || !data) {
      throw new Error(`Erro ao baixar arquivo ${bucket}/${storagePath}: ${error?.message || 'Arquivo vazio'}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Remove arquivo do Storage.
   */
  public static async deleteFile(bucket: string, storagePath: string): Promise<boolean> {
    try {
      const supabase = getServiceRoleClient();
      const { error } = await supabase.storage.from(bucket).remove([storagePath]);
      return !error;
    } catch {
      return false;
    }
  }
}
