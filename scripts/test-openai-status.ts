import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import { IntegrationService } from '../src/services/integrations/integration.service';

async function main() {
  const supabase = getSupabaseAdminClient();
  const service = new IntegrationService(supabase);
  const result = await service.testOpenAI('d4a03d1d-f80c-4f4e-bf6e-01e58054edf6');
  console.log('Result of testOpenAI:', result);
  try {
    const key = await service.resolveOpenAIKey('d4a03d1d-f80c-4f4e-bf6e-01e58054edf6');
    console.log('Resolved key ending in:', key.slice(-4));
    const testResp = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    console.log('Direct fetch models status:', testResp.status);
    const body = await testResp.json();
    console.log('Direct fetch models response:', body);
  } catch (e: any) {
    console.error('Error resolving key:', e.message);
  }
}

main();
