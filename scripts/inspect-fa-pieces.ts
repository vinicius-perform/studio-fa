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

async function run() {
  const sb = getServiceRoleClient();
  const { data: pieces, error } = await sb
    .from('client_pieces')
    .select('id, title, storage_bucket, storage_path, piece_type')
    .eq('client_id', 'c14b4641-620f-463a-9afb-0352c978974c');

  console.log('FAZENDO ACONTECER PIECES:', pieces?.length, 'ERR:', error);
  if (pieces && pieces.length > 0) {
    const first = pieces[0];
    const { data: fileData, error: dlErr } = await sb.storage
      .from(first.storage_bucket)
      .download(first.storage_path);
    console.log('STORAGE TEST FIRST PIECE:', fileData ? `OK, size: ${fileData.size} bytes` : `ERR: ${dlErr?.message}`);

    const { data: signed, error: signErr } = await sb.storage
      .from(first.storage_bucket)
      .createSignedUrl(first.storage_path, 3600);
    console.log('SIGNED URL TEST:', signed ? `OK, url exists (length: ${signed.signedUrl.length})` : `ERR: ${signErr?.message}`);
  }
}

run();
