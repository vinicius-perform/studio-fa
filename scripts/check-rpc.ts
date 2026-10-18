import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let serviceKey = '';
let supabaseUrl = '';

envContent.split('\n').forEach((line) => {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = v;
    if (k === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = v;
  }
});

const sb = createClient(supabaseUrl, serviceKey);

async function main() {
  const { data: buckets } = await sb.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => ({ name: b.name, public: b.public })));

  const functionsToTry = ['exec_sql', 'execute_sql', 'exec', 'run_sql', 'query', 'sql', 'has_client_access'];
  for (const fn of functionsToTry) {
    const { data, error } = await sb.rpc(fn, { query: 'SELECT 1;' } as any);
    console.log(`RPC ${fn}:`, error?.code, error?.message);
  }
}

main().catch(console.error);
