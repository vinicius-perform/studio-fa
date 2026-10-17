// src/services/export/export.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { SlideDocument, Layer } from '@/types/domain/composition';
import type { FormatDefinition } from '@/config/formats';
import { getFormatDefinition } from '@/config/formats';
import JSZip from 'jszip';
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
   * Renders layers to an HTML Canvas element at target resolution.
   * Runs in browser environment.
   */
  async renderDocumentToCanvas(
    document: SlideDocument,
    targetWidth: number,
    targetHeight: number
  ): Promise<HTMLCanvasElement> {
    if (typeof window === 'undefined') {
      throw new Error('renderDocumentToCanvas deve ser executado no navegador.');
    }

    const canvas = window.document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Falha ao obter contexto 2D do Canvas');

    // Scale factors from document canvas space to target resolution
    const scaleX = targetWidth / document.canvas.width;
    const scaleY = targetHeight / document.canvas.height;

    // 1. Solid background fill
    ctx.fillStyle = document.canvas.backgroundColor || '#0B0F17';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Sort layers by zIndex
    const sortedLayers = [...document.layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sortedLayers) {
      if (layer.visible === false) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      const lx = layer.x * scaleX;
      const ly = layer.y * scaleY;
      const lw = layer.width * scaleX;
      const lh = layer.height * scaleY;

      if (layer.type === 'shape' && 'fillColor' in layer) {
        ctx.fillStyle = layer.fillColor || '#ffffff';
        if (layer.cornerRadius && layer.cornerRadius > 0) {
          const r = layer.cornerRadius * scaleX;
          ctx.beginPath();
          ctx.roundRect(lx, ly, lw, lh, r);
          ctx.fill();
        } else {
          ctx.fillRect(lx, ly, lw, lh);
        }
      } else if (layer.type === 'overlay' && 'overlayType' in layer) {
        if (layer.overlayType === 'gradient_top') {
          const grad = ctx.createLinearGradient(0, ly, 0, ly + lh);
          grad.addColorStop(0, layer.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(lx, ly, lw, lh);
        } else if (layer.overlayType === 'gradient_bottom') {
          const grad = ctx.createLinearGradient(0, ly + lh, 0, ly);
          grad.addColorStop(0, layer.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(lx, ly, lw, lh);
        } else {
          ctx.fillStyle = layer.color;
          ctx.fillRect(lx, ly, lw, lh);
        }
      } else if ((layer.type === 'image' || layer.type === 'background') && 'imageUrl' in layer) {
        try {
          const img = await this.loadImage(layer.imageUrl);
          ctx.drawImage(img, lx, ly, lw, lh);
        } catch (err) {
          Logger.error({ operation: 'render_image_layer', result: 'error' }, err);
        }
      } else if (layer.type === 'logo' && 'logoUrl' in layer) {
        try {
          const img = await this.loadImage(layer.logoUrl);
          ctx.drawImage(img, lx, ly, lw, lh);
        } catch (err) {
          Logger.error({ operation: 'render_logo_layer', result: 'error' }, err);
        }
      } else if (layer.type === 'text') {
        const textLayer = layer as any;
        const fontSize = Math.round((textLayer.fontSize || 32) * scaleY);
        const fontWeight = textLayer.fontWeight || 'normal';
        const fontFamily = textLayer.fontFamily || 'sans-serif';

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textLayer.color || '#ffffff';
        ctx.textBaseline = 'top';

        // Word wrapping
        const words = (textLayer.text || '').split(' ');
        let line = '';
        let currentY = ly;
        const lineHeight = fontSize * (textLayer.lineHeight || 1.25);

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;

          if (testWidth > lw && n > 0) {
            if (textLayer.align === 'center') {
              const lineMetrics = ctx.measureText(line);
              ctx.fillText(line, lx + (lw - lineMetrics.width) / 2, currentY);
            } else if (textLayer.align === 'right') {
              const lineMetrics = ctx.measureText(line);
              ctx.fillText(line, lx + lw - lineMetrics.width, currentY);
            } else {
              ctx.fillText(line, lx, currentY);
            }
            line = words[n] + ' ';
            currentY += lineHeight;
          } else {
            line = testLine;
          }
        }

        // Draw last line
        if (textLayer.align === 'center') {
          const lineMetrics = ctx.measureText(line);
          ctx.fillText(line, lx + (lw - lineMetrics.width) / 2, currentY);
        } else if (textLayer.align === 'right') {
          const lineMetrics = ctx.measureText(line);
          ctx.fillText(line, lx + lw - lineMetrics.width, currentY);
        } else {
          ctx.fillText(line, lx, currentY);
        }
      }

      ctx.restore();
    }

    return canvas;
  }

  /**
   * Safe image loader with CORS handling
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Falha ao carregar imagem: ${src}`));
      img.src = src;
    });
  }

  /**
   * Generates Blob for canvas
   */
  async canvasToBlob(canvas: HTMLCanvasElement, mimeType = 'image/png'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao gerar Blob do canvas'));
      }, mimeType);
    });
  }

  /**
   * Creates a ZIP file containing all slides in high resolution
   */
  async generateBatchZip(
    slides: { filename: string; blob: Blob }[]
  ): Promise<Blob> {
    const zip = new JSZip();
    for (const slide of slides) {
      zip.file(slide.filename, slide.blob);
    }
    return zip.generateAsync({ type: 'blob' });
  }

  /**
   * Uploads final export to Supabase Storage 'exports' bucket and registers in client_assets
   */
  async persistExportAsset(params: {
    organizationId: string;
    clientId: string;
    blob: Blob;
    filename: string;
    width: number;
    height: number;
    userId: string;
  }): Promise<string> {
    const storagePath = `${params.organizationId}/${params.clientId}/exports/${crypto.randomUUID()}_${params.filename}`;

    const { error: uploadErr } = await this.supabase.storage
      .from('exports')
      .upload(storagePath, params.blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadErr) {
      Logger.error({ operation: 'upload_export_storage', result: 'error' }, uploadErr);
      throw new ValidationError(`Erro ao salvar arquivo no Storage de exportação: ${uploadErr.message}`);
    }

    // Register in client_assets
    const { data: asset, error: assetErr } = await this.supabase
      .from('client_assets')
      .insert({
        organization_id: params.organizationId,
        client_id: params.clientId,
        asset_type: 'export',
        label: `Exportação final: ${params.filename}`,
        storage_bucket: 'exports',
        storage_path: storagePath,
        original_filename: params.filename,
        mime_type: 'image/png',
        file_size_bytes: params.blob.size,
        width: params.width,
        height: params.height,
        uploaded_by: params.userId,
      })
      .select()
      .single();

    if (assetErr || !asset) {
      Logger.error({ operation: 'register_export_asset', result: 'error' }, assetErr);
    }

    return storagePath;
  }

  /**
   * Adds approved production to client's visual memory pool (Prompt Section 100)
   */
  async addProductionToMemory(params: {
    organizationId: string;
    clientId: string;
    projectId: string;
    title: string;
    assetId: string;
    referenceType?: 'instagram_post' | 'carousel';
    userId: string;
  }): Promise<void> {
    const { error } = await this.supabase.from('brand_references').insert({
      organization_id: params.organizationId,
      client_id: params.clientId,
      asset_id: params.assetId,
      title: `Referência aprovada: ${params.title}`,
      description: 'Produção aprovada pelo Studio FA incorporada à memória visual do cliente.',
      reference_type: params.referenceType || 'instagram_post',
      is_approved: true,
      tags: ['studio_fa_production', 'approved_history'],
      created_by: params.userId,
    });

    if (error) {
      Logger.error({ operation: 'add_production_to_memory', result: 'error' }, error);
      throw new ValidationError(`Erro ao adicionar à memória visual: ${error.message}`);
    }

    Logger.info({
      operation: 'add_production_to_memory',
      organizationId: params.organizationId,
      result: 'success',
      metadata: { clientId: params.clientId, projectId: params.projectId },
    });
  }
}
