// scripts/list-all-storage.ts
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
  const { data: brandList } = await supabase.storage.from('client-brand-assets').list();
  console.log('CLIENT BRAND ASSETS ROOT:', brandList);

  const { data: genList } = await supabase.storage.from('generated-assets').list();
  console.log('GENERATED ASSETS ROOT:', genList);
}

main().catch(console.error);
