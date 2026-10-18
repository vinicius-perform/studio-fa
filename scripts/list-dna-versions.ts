import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach((line) => {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !k.startsWith('#') && !process.env[k]) {
      process.env[k] = v;
    }
  }
});

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: versions } = await sb
    .from('brand_dna_versions')
    .select('id, version, status, source_piece_ids, model, prompt_version, created_at')
    .eq('client_id', 'd0000000-0000-0000-0000-000000000001')
    .order('version', { ascending: true });

  console.log('Versões registradas em brand_dna_versions:', versions);
}

main().catch(console.error);
