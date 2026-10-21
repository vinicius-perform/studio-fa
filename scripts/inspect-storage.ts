// scripts/inspect-storage.ts
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

import { getServiceRoleClient } from '../src/lib/supabase/server';

async function main() {
  const supabase = getServiceRoleClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('BUCKETS:', buckets?.map(b => b.name));

  const { data: brandFiles } = await supabase.storage.from('client-brand-assets').list('d4a03d1d-f80c-4f4e-bf6e-01e58054edf6/d0000000-0000-0000-0000-000000000020');
  console.log('BRAND ASSETS FILES:', brandFiles);

  const { data: piecesFiles } = await supabase.storage.from('client-pieces').list('d4a03d1d-f80c-4f4e-bf6e-01e58054edf6/d0000000-0000-0000-0000-000000000020');
  console.log('PIECES FILES:', piecesFiles);
}

main().catch(console.error);
