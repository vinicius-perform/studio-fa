// src/lib/image-fit.ts

export interface FocalPoint {
  /** Ponto focal horizontal normalizado de 0.0 (esquerda) a 1.0 (direita). Padrão: 0.5 */
  x: number;
  /** Ponto focal vertical normalizado de 0.0 (topo) a 1.0 (base). Padrão: 0.5 */
  y: number;
}

export interface ImageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageFitResult {
  crop: ImageCropRect;
  targetWidth: number;
  targetHeight: number;
  sourceAspectRatio: number;
  targetAspectRatio: number;
  effectiveAspectRatio: number;
  isCover: boolean;
}

/**
 * Calcula determinísticamente as coordenadas de recorte (cover crop) para adequar qualquer imagem
 * à proporção e dimensões exatas de um canvas de destino sem distorcer o aspect ratio,
 * respeitando o ponto focal configurado.
 */
export function calculateCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  focalPoint: FocalPoint = { x: 0.5, y: 0.5 }
): ImageFitResult {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return {
      crop: { x: 0, y: 0, width: Math.max(1, sourceWidth), height: Math.max(1, sourceHeight) },
      targetWidth,
      targetHeight,
      sourceAspectRatio: 1,
      targetAspectRatio: 1,
      effectiveAspectRatio: 1,
      isCover: false,
    };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  // Clampa ponto focal entre 0 e 1
  const fx = Math.max(0, Math.min(1, focalPoint.x ?? 0.5));
  const fy = Math.max(0, Math.min(1, focalPoint.y ?? 0.5));

  let cropWidth: number;
  let cropHeight: number;
  let cropX: number;
  let cropY: number;

  if (Math.abs(sourceRatio - targetRatio) < 0.001) {
    // Proporções idênticas: usa 100% dos pixels da fonte
    cropWidth = sourceWidth;
    cropHeight = sourceHeight;
    cropX = 0;
    cropY = 0;
  } else if (sourceRatio > targetRatio) {
    // Imagem fonte é mais larga que o canvas de destino (corta sobras horizontais)
    cropHeight = sourceHeight;
    cropWidth = Math.round(sourceHeight * targetRatio);
    const maxOffset = sourceWidth - cropWidth;
    cropX = Math.round(maxOffset * fx);
    cropY = 0;
  } else {
    // Imagem fonte é mais alta que o canvas de destino (corta sobras verticais)
    cropWidth = sourceWidth;
    cropHeight = Math.round(sourceWidth / targetRatio);
    const maxOffset = sourceHeight - cropHeight;
    cropX = 0;
    cropY = Math.round(maxOffset * fy);
  }

  // Assegura limites válidos
  cropX = Math.max(0, Math.min(sourceWidth - cropWidth, cropX));
  cropY = Math.max(0, Math.min(sourceHeight - cropHeight, cropY));

  return {
    crop: {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    },
    targetWidth,
    targetHeight,
    sourceAspectRatio: sourceRatio,
    targetAspectRatio: targetRatio,
    effectiveAspectRatio: cropWidth / cropHeight,
    isCover: true,
  };
}
