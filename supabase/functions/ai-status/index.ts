// supabase/functions/ai-status/index.ts
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/errors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { logEvent } from '../_shared/logger.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { user } = await requireAuth(req);

    // Read environment variables server-side
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const visionModel = Deno.env.get('OPENAI_VISION_MODEL') ?? 'gpt-4o';
    const imageModel = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-2.5-flare';
    const embeddingModel = Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';

    const isConfigured = Boolean(apiKey && apiKey.trim().length > 0);

    logEvent({
      requestId,
      userId: user.id,
      operation: 'ai_status_check',
      durationMs: Date.now() - startTime,
      result: 'success',
      metadata: { is_configured: isConfigured },
    });

    // NEVER return the actual key or sensitive secrets
    return jsonResponse({
      configured: isConfigured,
      provider: 'openai',
      models: {
        vision: visionModel,
        image: imageModel,
        embedding: embeddingModel,
      },
      message: isConfigured
        ? 'AI foundation provider configured on server'
        : 'AI provider key pending configuration on server',
    });
  } catch (err) {
    logEvent({
      requestId,
      operation: 'ai_status_check',
      durationMs: Date.now() - startTime,
      result: 'error',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });

    return errorResponse(err);
  }
});
