import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
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
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: pieces, error: piecesErr } = await sb.from('client_pieces').select('id').limit(1);
  console.log('client_pieces query:', { pieces, piecesErr });

  const { data: clients, error: clientsErr } = await sb.from('clients').select('id, dna, manual_guidelines, visual_memory_status').limit(1);
  console.log('clients query:', { clients, clientsErr });

  const { data: buckets, error: bucketsErr } = await sb.storage.listBuckets();
  console.log('buckets:', { buckets: buckets?.map(b => b.name), bucketsErr });
}

main().catch(console.error);
