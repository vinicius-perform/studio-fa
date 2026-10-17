// supabase/functions/_shared/logger.ts

export interface LogContext {
  requestId?: string;
  userId?: string | null;
  organizationId?: string | null;
  operation: string;
  durationMs?: number;
  result: 'success' | 'error' | 'pending';
  metadata?: Record<string, unknown>;
}

export function logEvent(context: LogContext): void {
  // Sanitize metadata to prevent sensitive leaks
  const sanitizedMetadata = { ...context.metadata };
  const sensitiveKeys = ['password', 'token', 'jwt', 'secret', 'apikey', 'key', 'authorization'];

  for (const k of Object.keys(sanitizedMetadata)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      sanitizedMetadata[k] = '[REDACTED]';
    }
  }

  const logPayload = {
    timestamp: new Date().toISOString(),
    request_id: context.requestId ?? crypto.randomUUID(),
    user_id: context.userId ?? null,
    organization_id: context.organizationId ?? null,
    operation: context.operation,
    duration_ms: context.durationMs,
    result: context.result,
    metadata: sanitizedMetadata,
  };

  console.log(JSON.stringify(logPayload));
}
