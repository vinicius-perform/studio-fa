// scripts/inspect-existing-project.ts
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

  // 1. Busca os últimos client_assets gerados
  const { data: assets, error: assetErr } = await supabase
    .from('client_assets')
    .select('id, asset_type, storage_bucket, storage_path, metadata, created_at')
    .eq('asset_type', 'generated_image')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('=== GENERATED ASSETS NA BASE ===');
  console.log(JSON.stringify(assets, null, 2));

  // 2. Busca últimas compositions
  const { data: comps, error: compErr } = await supabase
    .from('slide_compositions')
    .select('id, slide_id, project_id, revision, document, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('=== COMPOSITIONS NA BASE ===');
  console.log(JSON.stringify(comps, null, 2));

  // 3. Busca projetos correspondentes
  if (comps && comps.length > 0) {
    const projectIds = Array.from(new Set(comps.map((c) => c.project_id).filter(Boolean)));
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, format, status, client_id, organization_id')
      .in('id', projectIds);

    console.log('=== PROJETOS CORRESPONDENTES ===');
    console.log(JSON.stringify(projects, null, 2));
  }
}

main().catch(console.error);
