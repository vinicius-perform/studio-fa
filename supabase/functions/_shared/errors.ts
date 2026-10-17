// supabase/functions/_shared/errors.ts
import { corsHeaders } from './cors.ts';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_SERVER_ERROR'
  | 'VALIDATION_ERROR';

export class AppHttpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'AppHttpError';
  }
}

export function errorResponse(error: unknown): Response {
  let status = 500;
  let code: ErrorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Ocorreu um erro interno no servidor.';

  if (error instanceof AppHttpError) {
    status = error.status;
    code = error.code;
    message = error.message;
  } else if (error instanceof Error) {
    // Redact internal error specifics in production
    if (error.message.includes('permission') || error.message.includes('42501')) {
      status = 403;
      code = 'FORBIDDEN';
      message = 'Você não possui permissão para realizar esta ação.';
    } else if (error.message.includes('JWT') || error.message.includes('auth')) {
      status = 401;
      code = 'UNAUTHORIZED';
      message = 'Sessão inválida ou expirada.';
    }
  }

  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
      },
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
