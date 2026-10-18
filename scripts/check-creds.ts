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
  const { data: creds, error } = await sb.from('integration_credentials').select('*');
  console.log('integration_credentials count:', creds?.length, { error });
  if (creds && creds.length > 0) {
    console.log('Provider:', creds[0].provider, 'Last tested:', creds[0].last_tested_at, 'Status:', creds[0].status);
  }
}

main().catch(console.error);
