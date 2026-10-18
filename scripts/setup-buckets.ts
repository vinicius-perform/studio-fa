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
  console.log('Criando buckets se não existirem...');
  const res1 = await sb.storage.createBucket('client-pieces', {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  });
  console.log('client-pieces bucket creation:', res1);

  const res2 = await sb.storage.createBucket('custom-fonts', {
    public: false,
    fileSizeLimit: 20971520,
    allowedMimeTypes: [
      'font/ttf',
      'font/otf',
      'font/woff',
      'font/woff2',
      'application/x-font-ttf',
      'application/x-font-otf',
      'application/font-woff',
      'application/font-woff2',
    ],
  });
  console.log('custom-fonts bucket creation:', res2);

  const { data: buckets } = await sb.storage.listBuckets();
  console.log('Buckets atuais:', buckets?.map(b => b.name));
}

main().catch(console.error);
