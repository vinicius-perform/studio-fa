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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: orgs, error: orgsErr } = await sb.from('organizations').select('id, name').limit(5);
  console.log('organizations:', { count: orgs?.length, orgs, orgsErr });

  const { data: profiles, error: profsErr } = await sb.from('profiles').select('id, email, full_name').limit(5);
  console.log('profiles:', { count: profiles?.length, profiles, profsErr });

  const { data: clients, error: clientsErr } = await sb.from('clients').select('id, name').limit(5);
  console.log('clients:', { count: clients?.length, clients, clientsErr });

  const { data: pieces, error: piecesErr } = await sb.from('client_pieces').select('id').limit(5);
  console.log('client_pieces:', { count: pieces?.length, piecesErr });

  const { data: dnaVersions, error: dnaErr } = await sb.from('brand_dna_versions').select('id').limit(5);
  console.log('brand_dna_versions:', { count: dnaVersions?.length, dnaErr });

  const { data: brandProfiles, error: bpErr } = await sb.from('brand_profiles').select('id').limit(5);
  console.log('brand_profiles:', { count: brandProfiles?.length, bpErr });

  const { data: integrations, error: intErr } = await sb.from('integration_settings').select('*').limit(5);
  console.log('integration_settings:', { count: integrations?.length, integrations, intErr });

  const { data: creds, error: credErr } = await sb.from('integration_credentials').select('id, provider').limit(5);
  console.log('integration_credentials:', { count: creds?.length, creds, credErr });
}

main().catch(console.error);
