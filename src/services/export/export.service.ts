// src/services/export/export.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/lib/logger';
import { ValidationError } from '@/lib/errors';

export interface ExportSlideOptions {
  mimeType?: 'image/png' | 'image/jpeg';
  quality?: number; // 0 to 1 (for jpeg)
}

export class ExportService {
  constructor(private readonly supabase: SupabaseClient<any, any, any>) {}

  /**
   * Sanitizes string for filename
   */
  public static sanitizeFilename(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Formats standard export filename: {client_slug}_{date}_slide-{index}.{ext}
   */
  public static formatFilename(params: {
    clientSlug: string;
    dateStr?: string;
    slideIndex: number;
    ext?: string;
  }): string {
    const date = params.dateStr || new Date().toISOString().split('T')[0];
    const idx = String(params.slideIndex + 1).padStart(2, '0');
    const ext = params.ext || 'png';
    return `${this.sanitizeFilename(params.clientSlug)}_${date}_slide-${idx}.${ext}`;
  }

  /**
   * Dispara o download direto no navegador a partir de uma URL ou blob de imagem.
   */
  public static async triggerBrowserDownload(url: string, filename: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      Logger.error(
        {
          operation: 'triggerBrowserDownload',
          result: 'error',
          metadata: { error: err.message },
        },
        err
      );
      // Fallback: abre a imagem diretamente
      window.open(url, '_blank');
    }
  }

  /**
   * Exporta múltiplas imagens (ex: carrossel) compactadas em um único arquivo ZIP.
   */
  public static async exportCarouselZip(params: {
    clientSlug: string;
    images: { url: string; index: number; ext?: string }[];
  }): Promise<void> {
    if (typeof window === 'undefined') return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const date = new Date().toISOString().split('T')[0];

    for (const img of params.images) {
      try {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const filename = this.formatFilename({
          clientSlug: params.clientSlug,
          dateStr: date,
          slideIndex: img.index,
          ext: img.ext || 'png',
        });
        zip.file(filename, blob);
      } catch (err: any) {
        console.warn(`[ExportService] Falha ao baixar lâmina ${img.index} para ZIP:`, err.message);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = `${this.sanitizeFilename(params.clientSlug)}_${date}_carrossel.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(zipUrl);
  }
}
