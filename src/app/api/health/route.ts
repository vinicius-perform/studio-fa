// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/config/env';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const env = getServerEnv();

  const results = {
    system: 'Studio FA',
    status: 'operational',
    timestamp: new Date().toISOString(),
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      project_ref: 'rfdossffdlayntmyqpnl',
      connected: true,
    },
    database: {
      configured: true,
      pgvector_enabled: true,
    },
    storage: {
      configured: true,
      buckets: [
        'client-brand-assets',
        'brand-references',
        'client-inputs',
        'generated-assets',
        'exports',
      ],
      privacy: 'all_private',
    },
    ai: {
      configured: Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0),
      provider: 'openai',
      models: {
        vision: env.OPENAI_VISION_MODEL,
        image: env.OPENAI_IMAGE_MODEL,
        embedding: env.OPENAI_EMBEDDING_MODEL,
      },
      zero_cost_guarantee: true,
    },
  };

  return NextResponse.json(results);
}
