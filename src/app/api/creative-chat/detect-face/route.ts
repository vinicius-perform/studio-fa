// src/app/api/creative-chat/detect-face/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess, AuthError, ForbiddenError } from '@/lib/auth/server-guards';
import { IntegrationService } from '@/services/integrations/integration.service';
import { StorageService } from '@/services/storage/storage.service';
import { FaceDetectionService } from '@/services/ai/face-detection.service';
import { SubjectSegmentationService } from '@/services/image/subject-segmentation.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, fileBase64, storagePath } = body;

    if (!clientId || (!fileBase64 && !storagePath)) {
      return NextResponse.json(
        { error: { message: 'clientId e imagem (fileBase64 ou storagePath) são obrigatórios.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);
    await requireClientAccess(supabase, session, clientId);

    let imageBuffer: Buffer | null = null;
    if (storagePath) {
      imageBuffer = await StorageService.downloadAsBuffer('client-pieces', storagePath).catch(() => null);
    }

    if (!imageBuffer && fileBase64) {
      const cleanB64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      imageBuffer = Buffer.from(cleanB64, 'base64');
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: { message: 'Não foi possível carregar os bytes da imagem.' } },
        { status: 400 }
      );
    }

    const integrationService = new IntegrationService(supabase);
    const apiKey = await integrationService.resolveOpenAIKey(session.organizationId).catch(() => undefined);

    // 1. Detecção Facial via GPT-4o Vision
    const faceResult = await FaceDetectionService.detectFaces({
      apiKey,
      imageBuffer,
    });

    // 2. Remoção de Fundo / Foreground Extraction local e determinística
    let cutoutDataUrl: string | undefined = undefined;
    let cutoutStoragePath: string | undefined = undefined;
    let segmentationStatus: 'ready' | 'error' = 'ready';
    let segmentationError: string | undefined = undefined;

    try {
      const segResult = await SubjectSegmentationService.removeBackground(imageBuffer);
      cutoutDataUrl = segResult.cutoutDataUrl;

      // Persiste o recorte transparente no storage privado
      try {
        const uploadCutout = await StorageService.uploadBuffer({
          bucket: 'client-pieces',
          organizationId: session.organizationId,
          clientId,
          folder: 'pieces',
          originalFilename: `subject_cutout_${Date.now()}.png`,
          buffer: segResult.cutoutBuffer,
          mimeType: 'image/png',
        });
        cutoutStoragePath = uploadCutout.storagePath;
      } catch (storageErr: any) {
        console.warn('[detect-face] Aviso ao persistir cutout no storage:', storageErr?.message);
      }
    } catch (segErr: any) {
      console.warn('[detect-face] Falha na segmentação de fundo do sujeito:', segErr?.message);
      segmentationStatus = 'error';
      segmentationError = 'Não foi possível separar a pessoa do fundo.';
    }

    return NextResponse.json({
      success: true,
      ...faceResult,
      cutoutDataUrl,
      cutoutStoragePath,
      hasCutout: segmentationStatus === 'ready',
      segmentationStatus,
      segmentationError,
      faces: faceResult.faces.map((f) => ({
        id: f.id,
        box_2d: f.box_2d,
        cropDataUrl: f.cropDataUrl,
      })),
      primaryFaceCropBuffer: undefined,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });

    console.warn('[POST /api/creative-chat/detect-face] Aviso no processamento do sujeito:', err?.message);
    return NextResponse.json({
      success: false,
      hasFace: false,
      faceCount: 0,
      hasMultipleFaces: false,
      faces: [],
      hasCutout: false,
      segmentationStatus: 'error',
      segmentationError: 'Não foi possível separar a pessoa do fundo.',
      statusText: 'Objeto principal anexado',
    });
  }
}
