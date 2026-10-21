// scripts/inspect-users.ts
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
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  console.log('AUTH USERS:', JSON.stringify(authData?.users?.map(u => ({ id: u.id, email: u.email })), null, 2));

  const { data: members } = await supabase.from('organization_members').select('*');
  console.log('MEMBERS:', JSON.stringify(members, null, 2));

  const { data: clients } = await supabase.from('clients').select('id, name').limit(5);
  console.log('CLIENTS:', JSON.stringify(clients, null, 2));
}

main().catch(console.error);
