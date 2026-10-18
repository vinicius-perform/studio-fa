import { getServiceRoleClient } from '../src/lib/supabase/server';

async function main() {
  const sb = getServiceRoleClient();
  const { data, error } = await sb.from('brand_dna_versions').select('id').limit(1);
  console.log('brand_dna_versions query result:', { data, error });
}

main().catch(console.error);
