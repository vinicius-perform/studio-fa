// src/services/ai/face-detection.service.ts
import sharp from 'sharp';

export interface DetectedFace {
  id: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  cropBuffer: Buffer;
  cropDataUrl: string;
}

export interface FaceDetectionResult {
  faceCount: number;
  hasFace: boolean;
  hasMultipleFaces: boolean;
  faces: DetectedFace[];
  primaryFaceCropBuffer?: Buffer;
  primaryFaceCropDataUrl?: string;
  statusText: string;
}

export class FaceDetectionService {
  /**
   * Detecta rostos humanos em uma foto de objeto principal via GPT-4o Vision
   * e gera crops faciais em alta resolução com respiro e canal alpha/RGB perfeito.
   */
  public static async detectFaces(params: {
    apiKey?: string;
    imageBuffer: Buffer;
  }): Promise<FaceDetectionResult> {
    const { apiKey, imageBuffer } = params;

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        faceCount: 0,
        hasFace: false,
        hasMultipleFaces: false,
        faces: [],
        statusText: 'Sem chave de API configurada para detecção facial',
      };
    }

    try {
      const meta = await sharp(imageBuffer).metadata();
      const origW = meta.width || 800;
      const origH = meta.height || 800;

      // Redimensiona para envio ultrarrápido ao Vision (~80KB)
      const resized = await sharp(imageBuffer)
        .resize({ width: 800, height: 800, fit: 'inside' })
        .jpeg({ quality: 85 })
        .toBuffer();

      const b64 = resized.toString('base64');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Detect all clearly visible human faces in this image.
Return ONLY valid JSON matching this schema:
{
  "faceCount": number,
  "faces": [
    {
      "box_2d": [ymin, xmin, ymax, xmax] // normalized 0 to 1000
    }
  ]
}
If no human faces are present, return { "faceCount": 0, "faces": [] }.
No markdown formatting, just pure JSON.`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${b64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 300,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        console.warn('[FaceDetectionService] Chamada ao Vision falhou:', response.status);
        return {
          faceCount: 0,
          hasFace: false,
          hasMultipleFaces: false,
          faces: [],
          statusText: 'Falha ao analisar faces na imagem',
        };
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '{}';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const rawFaces: Array<{ box_2d: [number, number, number, number] }> = Array.isArray(parsed.faces)
        ? parsed.faces
        : [];
      const faceCount = typeof parsed.faceCount === 'number' ? parsed.faceCount : rawFaces.length;

      if (faceCount === 0 || rawFaces.length === 0) {
        return {
          faceCount: 0,
          hasFace: false,
          hasMultipleFaces: false,
          faces: [],
          statusText: 'Objeto principal anexado (sem rosto humano detectado)',
        };
      }

      const faces: DetectedFace[] = [];

      for (let idx = 0; idx < rawFaces.length; idx++) {
        const item = rawFaces[idx];
        const [ymin, xmin, ymax, xmax] = item.box_2d;

        const boxH = ymax - ymin;
        const boxW = xmax - xmin;
        // 25% de respiro para incluir topo do cabelo, queixo e orelhas
        const padY = boxH * 0.25;
        const padX = boxW * 0.25;

        const cropTop = Math.max(0, Math.round(((ymin - padY) / 1000) * origH));
        const cropLeft = Math.max(0, Math.round(((xmin - padX) / 1000) * origW));
        const cropHeight = Math.min(origH - cropTop, Math.round(((boxH + padY * 2) / 1000) * origH));
        const cropWidth = Math.min(origW - cropLeft, Math.round(((boxW + padX * 2) / 1000) * origW));

        try {
          const cropBuf = await sharp(imageBuffer)
            .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
            .resize({ width: 512, height: 512, fit: 'cover' })
            .png()
            .toBuffer();

          const cropDataUrl = `data:image/png;base64,${cropBuf.toString('base64')}`;

          faces.push({
            id: `face-${idx + 1}`,
            box_2d: item.box_2d,
            cropBuffer: cropBuf,
            cropDataUrl,
          });
        } catch (cropErr: any) {
          console.warn(`[FaceDetectionService] Erro ao recortar face ${idx + 1}:`, cropErr?.message);
        }
      }

      const primary = faces[0];
      const hasMultiple = faces.length > 1;

      return {
        faceCount: faces.length,
        hasFace: faces.length > 0,
        hasMultipleFaces: hasMultiple,
        faces,
        primaryFaceCropBuffer: primary?.cropBuffer,
        primaryFaceCropDataUrl: primary?.cropDataUrl,
        statusText: hasMultiple
          ? `Mais de 1 pessoa detectada (${faces.length} rostos). Selecione a pessoa principal.`
          : 'Rosto detectado — identidade será preservada',
      };
    } catch (err: any) {
      console.warn('[FaceDetectionService] Erro no pipeline de detecção facial:', err?.message);
      return {
        faceCount: 0,
        hasFace: false,
        hasMultipleFaces: false,
        faces: [],
        statusText: 'Objeto principal anexado',
      };
    }
  }

  /**
   * Analisa a identidade facial em nível fotográfico a partir do crop facial de alta resolução.
   */
  public static async analyzeFacialIdentity(params: {
    apiKey: string;
    faceCropBuffer: Buffer;
  }): Promise<string> {
    const { apiKey, faceCropBuffer } = params;
    try {
      const b64 = faceCropBuffer.toString('base64');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe the visual appearance, hairstyle, face structure, skin tone, eye shape, nose, mouth and distinctive facial styling of the person in this cropped portrait so an artwork generation model can recreate their exact likeness and identity faithfully.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${b64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 250,
          temperature: 0.1,
        }),
      });

      if (!response.ok) return '';
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || '';
    } catch {
      return '';
    }
  }
}
