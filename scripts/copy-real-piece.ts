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
  const { data: downloadData, error: dlErr } = await sb.storage
    .from('client-pieces')
    .download('d0000000-0000-0000-0000-000000000001/test-e2e-1792281704587.png');

  if (dlErr || !downloadData) {
    throw new Error(`Falha no download: ${dlErr?.message}`);
  }

  const buf = Buffer.from(await downloadData.arrayBuffer());
  console.log(`Baixados ${buf.length} bytes reais da peça de referência da Fase B.`);

  const { error: upErr } = await sb.storage
    .from('client-pieces')
    .upload('d0000000-0000-0000-0000-000000000020/feed-tech.png', buf, {
      contentType: 'image/png',
      upsert: true,
    });

  if (upErr) {
    throw new Error(`Falha no upload: ${upErr.message}`);
  }

  console.log('Upload de feed-tech.png para client 20 concluído com sucesso!');
}

main().catch(console.error);
