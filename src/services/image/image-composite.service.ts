// src/services/image/image-composite.service.ts
import sharp from 'sharp';
import { SubjectSegmentationService } from './subject-segmentation.service';

export interface OverlayLogoParams {
  baseImageBuffer: Buffer;
  logoBuffer: Buffer;
  position?: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  paddingX?: number;
  paddingY?: number;
  maxLogoWidth?: number;
  maxLogoHeight?: number;
}

export interface IntegrateSubjectParams {
  baseArtworkBuffer: Buffer;
  subjectPhotoBuffer?: Buffer;
  subjectCutoutBuffer?: Buffer;
  scaleRatio?: number;
  verticalAlign?: 'bottom' | 'center';
  horizontalAlign?: 'center' | 'left' | 'right';
  fadeBottomPercent?: number;
}

export class ImageCompositeService {
  /**
   * Integra a pessoa real recortada com transparência alpha como base visual da composição,
   * preservando 100% dos pixels fisionômicos (olhos, nariz, boca, cabelo, pele)
   * SEM sobrepor o retângulo ou fundo original da foto.
   */
  public static async integrateSubject(params: IntegrateSubjectParams): Promise<Buffer> {
    const {
      baseArtworkBuffer,
      subjectPhotoBuffer,
      subjectCutoutBuffer,
      scaleRatio = 0.76,
      verticalAlign = 'bottom',
      horizontalAlign = 'center',
    } = params;

    try {
      // 1. Obtém o recorte transparente (alpha cutout) da pessoa
      let cleanCutoutBuffer: Buffer | null = null;

      if (subjectCutoutBuffer && (await SubjectSegmentationService.isAlphaCutout(subjectCutoutBuffer))) {
        cleanCutoutBuffer = subjectCutoutBuffer;
      } else if (subjectPhotoBuffer) {
        // Se já for um cutout com alpha
        if (await SubjectSegmentationService.isAlphaCutout(subjectPhotoBuffer)) {
          cleanCutoutBuffer = subjectPhotoBuffer;
        } else {
          // Executa segmentação e remoção de fundo local
          const segResult = await SubjectSegmentationService.removeBackground(subjectPhotoBuffer);
          cleanCutoutBuffer = segResult.cutoutBuffer;
        }
      }

      // REGRA CRÍTICA (Seção 6 e 14): Se não houver recorte transparente válido,
      // NUNCA sobrepõe a imagem retangular bruta com fundo.
      if (!cleanCutoutBuffer) {
        console.warn('[ImageCompositeService] Segmentação ausente ou inválida. Não inserindo imagem retangular.');
        throw new Error('Não foi possível separar a pessoa do fundo.');
      }

      const artMeta = await sharp(baseArtworkBuffer).metadata();
      const artW = artMeta.width || 1080;
      const artH = artMeta.height || 1350;

      // 2. Altura alvo da pessoa na composição final (proporção harmônica)
      const targetH = Math.round(artH * scaleRatio);

      // Redimensiona o recorte com alta fidelidade sem perda de detalhes faciais
      const resizedCutout = await sharp(cleanCutoutBuffer)
        .resize({
          height: targetH,
          fit: 'inside',
          withoutEnlargement: false,
        })
        .png()
        .toBuffer();

      const subMeta = await sharp(resizedCutout).metadata();
      const subW = subMeta.width || 500;
      const subH = subMeta.height || targetH;

      // 3. Máscara de gradiente suave na base (elimina cortes secos na cintura/busto)
      const maskSvg = Buffer.from(`
        <svg width="${subW}" height="${subH}">
          <defs>
            <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fff" stop-opacity="1" />
              <stop offset="84%" stop-color="#fff" stop-opacity="1" />
              <stop offset="95%" stop-color="#fff" stop-opacity="0.5" />
              <stop offset="100%" stop-color="#fff" stop-opacity="0" />
            </linearGradient>
          </defs>
          <rect width="${subW}" height="${subH}" fill="url(#bottomFade)" />
        </svg>
      `);

      const maskPng = await sharp(maskSvg).png().toBuffer();

      const fadedSubject = await sharp(resizedCutout)
        .ensureAlpha()
        .composite([
          {
            input: maskPng,
            blend: 'dest-in',
          },
        ])
        .png()
        .toBuffer();

      // 4. Sombra suave de contato (Contact Shadow / Rim Light) para evitar efeito "adesivo"
      // Extrai o canal alpha do sujeito e aplica blur e tint escuro semi-transparente
      const alphaMask = await sharp(resizedCutout)
        .extractChannel(3)
        .toBuffer();

      const blurredShadow = await sharp(alphaMask)
        .blur(14)
        .toBuffer();

      const shadowLayer = await sharp({
        create: {
          width: subW,
          height: subH,
          channels: 4,
          background: { r: 12, g: 12, b: 18, alpha: 0.35 },
        },
      })
        .composite([{ input: blurredShadow, blend: 'dest-in' }])
        .png()
        .toBuffer();

      // 5. Calcula coordenadas de posicionamento
      let posX = Math.round((artW - subW) / 2);
      if (horizontalAlign === 'left') posX = Math.round(artW * 0.05);
      if (horizontalAlign === 'right') posX = Math.round(artW - subW - artW * 0.05);

      let posY = artH - subH;
      if (verticalAlign === 'center') posY = Math.round((artH - subH) / 2);

      posX = Math.max(0, posX);
      posY = Math.max(0, posY);

      // 6. Composição em camadas: Base Artística + Sombra de Contato + Pessoa Recortada
      const compositeResult = await sharp(baseArtworkBuffer)
        .composite([
          {
            input: shadowLayer,
            left: posX + 4,
            top: posY + 8,
          },
          {
            input: fadedSubject,
            left: posX,
            top: posY,
          },
        ])
        .png({ quality: 100 })
        .toBuffer();

      return compositeResult;
    } catch (err: any) {
      console.warn('[ImageCompositeService] Falha ao integrar pessoa na composição:', err?.message);
      if (err.message && err.message.startsWith('Não foi possível separar')) {
        throw err;
      }
      return baseArtworkBuffer;
    }
  }

  /**
   * Sobrepõe a logomarca oficial do cliente sobre a imagem gerada pela IA,
   * preservando transparência alpha perfeita e proporção exata da marca.
   */
  public static async overlayLogo(params: OverlayLogoParams): Promise<Buffer> {
    const {
      baseImageBuffer,
      logoBuffer,
      position = 'top_left',
      paddingX = 70,
      paddingY = 70,
      maxLogoWidth = 240,
      maxLogoHeight = 80,
    } = params;

    try {
      const baseMeta = await sharp(baseImageBuffer).metadata();
      const baseWidth = baseMeta.width || 1080;
      const baseHeight = baseMeta.height || 1350;

      // Redimensiona o logo proporcionalmente dentro do box máximo
      const resizedLogoBuffer = await sharp(logoBuffer)
        .resize({
          width: maxLogoWidth,
          height: maxLogoHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

      const logoMeta = await sharp(resizedLogoBuffer).metadata();
      const logoW = logoMeta.width || maxLogoWidth;
      const logoH = logoMeta.height || maxLogoHeight;

      // Calcula coordenadas baseadas na posição desejada
      let left = paddingX;
      let top = paddingY;

      if (position === 'top_right') {
        left = baseWidth - logoW - paddingX;
        top = paddingY;
      } else if (position === 'bottom_left') {
        left = paddingX;
        top = baseHeight - logoH - paddingY;
      } else if (position === 'bottom_right') {
        left = baseWidth - logoW - paddingX;
        top = baseHeight - logoH - paddingY;
      }

      // Aplica composite com canal alpha
      const compositeResult = await sharp(baseImageBuffer)
        .composite([
          {
            input: resizedLogoBuffer,
            left: Math.max(0, Math.round(left)),
            top: Math.max(0, Math.round(top)),
          },
        ])
        .png({ quality: 100 })
        .toBuffer();

      return compositeResult;
    } catch (err: any) {
      console.warn('[ImageCompositeService] Falha ao sobrepor logotipo na imagem, mantendo base:', err?.message);
      return baseImageBuffer;
    }
  }
}
