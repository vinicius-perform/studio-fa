// src/lib/logger/index.ts

export interface LogEntry {
  requestId?: string;
  userId?: string | null;
  organizationId?: string | null;
  operation: string;
  durationMs?: number;
  result: 'success' | 'error' | 'started';
  metadata?: Record<string, unknown>;
}

export class Logger {
  private static sanitize(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!obj) return undefined;
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'token', 'jwt', 'secret', 'apikey', 'key', 'authorization'];

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static info(entry: LogEntry): void {
    const payload = {
      level: 'info',
      timestamp: new Date().toISOString(),
      request_id: entry.requestId,
      user_id: entry.userId ?? null,
      organization_id: entry.organizationId ?? null,
      operation: entry.operation,
      duration_ms: entry.durationMs,
      result: entry.result,
      metadata: this.sanitize(entry.metadata),
    };

    console.log(JSON.stringify(payload));
  }

  static error(entry: LogEntry, error?: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const payload = {
      level: 'error',
      timestamp: new Date().toISOString(),
      request_id: entry.requestId,
      user_id: entry.userId ?? null,
      organization_id: entry.organizationId ?? null,
      operation: entry.operation,
      duration_ms: entry.durationMs,
      result: 'error',
      error_message: errorMessage,
      metadata: this.sanitize(entry.metadata),
    };

    console.error(JSON.stringify(payload));
  }
}
