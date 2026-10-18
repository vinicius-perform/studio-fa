// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { getServerEnv } from '@/config/env';

export function getSupabaseServerClient() {
  const env = getServerEnv();
  const cookieStore = cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignored when called from Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Ignored when called from Server Component
          }
        },
      },
      global: {
        fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const optSignal = options.signal;
          const signal = optSignal && typeof (AbortSignal as any).any === 'function'
            ? (AbortSignal as any).any([optSignal, controller.signal])
            : controller.signal;
          return fetch(url, { ...options, signal }).finally(() => clearTimeout(timeoutId));
        },
      },
    }
  );
}

export function getServiceRoleClient() {
  const env = getServerEnv();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente.');
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}


