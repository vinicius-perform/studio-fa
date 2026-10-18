// src/config/env.ts
import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatória'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_VISION_MODEL: z.string().default('gpt-4o'),
  OPENAI_IMAGE_MODEL: z.string().default('dall-e-3'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  STUDIO_FA_ENABLE_DEV_STORE: z.string().default('false'),
  STUDIO_FA_INTEGRATIONS_MASTER_KEY: z.string().optional(),
  STUDIO_FA_BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('Tentativa de acessar getServerEnv() no cliente! Secrets devem existir apenas server-side.');
  }

  const isTest = process.env.NODE_ENV === 'test';

  return serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (isTest ? 'https://test.supabase.co' : undefined),
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      (isTest ? 'test-anon-key' : undefined),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    SUPABASE_URL:
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (isTest ? 'https://test.supabase.co' : undefined),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_VISION_MODEL: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL || 'dall-e-3',
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    STUDIO_FA_ENABLE_DEV_STORE: process.env.STUDIO_FA_ENABLE_DEV_STORE || 'false',
    STUDIO_FA_INTEGRATIONS_MASTER_KEY: process.env.STUDIO_FA_INTEGRATIONS_MASTER_KEY,
    STUDIO_FA_BOOTSTRAP_ADMIN_EMAIL: process.env.STUDIO_FA_BOOTSTRAP_ADMIN_EMAIL,
  });
}

export function isSupabaseConfigured(): boolean {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url || !anonKey) return false;
  if (
    anonKey === 'your-supabase-anon-key-here' ||
    anonKey.startsWith('your-') ||
    anonKey === 'test-anon-key' ||
    anonKey.length < 20 ||
    url.includes('your-')
  ) {
    return false;
  }
  return true;
}

/**
 * DevStore só pode funcionar explicitamente se:
 * 1. Não estiver em produção (NODE_ENV !== 'production')
 * 2. E a variável STUDIO_FA_ENABLE_DEV_STORE for explicitamente "true".
 * Em produção ou quando false, o Supabase é a fonte oficial dos dados
 * e qualquer indisponibilidade retorna erro controlado.
 */
export function isDevStoreAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.STUDIO_FA_ENABLE_DEV_STORE === 'true';
}
