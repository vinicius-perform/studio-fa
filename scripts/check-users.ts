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
  const { data: usersData, error } = await sb.auth.admin.listUsers();
  console.log('auth.users count:', usersData?.users?.length, { error });
  if (usersData?.users) {
    for (const u of usersData.users) {
      console.log('User:', u.id, u.email);
    }
  }

  const { data: members } = await sb.from('organization_members').select('*');
  console.log('organization_members:', members);
}

main().catch(console.error);
