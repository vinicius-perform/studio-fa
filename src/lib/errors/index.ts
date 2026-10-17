// src/lib/errors/index.ts

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'STORAGE_ERROR'
  | 'AI_ERROR';

export interface FormattedError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): FormattedError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Você precisa estar autenticado para realizar esta ação.') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não possui permissão para realizar esta ação.') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso', identifier?: string) {
    super(
      'NOT_FOUND',
      404,
      identifier ? `${resource} (${identifier}) não foi encontrado.` : `${resource} não foi encontrado.`
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}

export function formatError(err: unknown): FormattedError {
  if (err instanceof AppError) {
    return err.toJSON();
  }

  if (err instanceof Error) {
    // Sanitize database or internal messages
    if (err.message.includes('permission') || err.message.includes('42501')) {
      return {
        error: {
          code: 'FORBIDDEN',
          message: 'Você não possui permissão para realizar esta ação.',
        },
      };
    }
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno. Tente novamente mais tarde.',
    },
  };
}
