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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: list1 } = await sb.storage.from('client-pieces').list('d0000000-0000-0000-0000-000000000001');
  console.log('files in d0000000-0000-0000-0000-000000000001:', list1);

  // If teste.png exists, copy or upload to d0000000-0000-0000-0000-000000000020/feed-tech.png
  const { data: downloadData, error: dlErr } = await sb.storage.from('client-pieces').download('d0000000-0000-0000-0000-000000000001/teste.png');
  console.log('download teste.png:', { size: downloadData?.size, dlErr });

  if (downloadData) {
    const buf = Buffer.from(await downloadData.arrayBuffer());
    const { error: upErr } = await sb.storage.from('client-pieces').upload('d0000000-0000-0000-0000-000000000020/feed-tech.png', buf, {
      contentType: 'image/png',
      upsert: true,
    });
    console.log('uploaded to d0000000-0000-0000-0000-000000000020/feed-tech.png:', { upErr });
  }
}

main().catch(console.error);
