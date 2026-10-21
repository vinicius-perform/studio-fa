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

async function audit() {
  const supabase = getServiceRoleClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';

  console.log('=== AUDIT integration_settings ===');
  const { data: intSettings, error: err1 } = await (supabase as any)
    .from('integration_settings')
    .select('*')
    .eq('organization_id', orgId);
  console.log('integration_settings:', JSON.stringify(intSettings, null, 2));
  console.log('error1:', err1);

  console.log('=== AUDIT integration_credentials ===');
  const { data: orgCreds, error: err3 } = await (supabase as any)
    .from('integration_credentials')
    .select('organization_id, provider, status, created_at')
    .eq('organization_id', orgId);
  console.log('integration_credentials:', JSON.stringify(orgCreds, null, 2));
  console.log('error3:', err3);
}

audit().catch(console.error);
