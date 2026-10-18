import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
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

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';

  // 1. Teste: Cliente criado SEM peças
  const noPieceClientId = 'd0000000-0000-0000-0000-000000000010';
  const { error: noPieceErr } = await sb.from('clients').upsert({
    id: noPieceClientId,
    organization_id: orgId,
    name: 'Cliente Sem Referências',
    slug: 'cliente-sem-referencias',
    niche: 'Serviços',
    status: 'active',
    brand_status: 'empty',
    visual_memory_status: 'awaiting_references',
    dna: {},
    manual_guidelines: null,
  });

  if (noPieceErr) throw noPieceErr;

  const { data: noPieceClient } = await sb
    .from('clients')
    .select('id, name, visual_memory_status, brand_status, dna')
    .eq('id', noPieceClientId)
    .single();

  const { data: piecesForNoPiece } = await sb
    .from('client_pieces')
    .select('id')
    .eq('client_id', noPieceClientId);

  console.log('Cliente sem peças criado:', {
    name: noPieceClient?.name,
    visual_memory_status: noPieceClient?.visual_memory_status,
    dna_is_empty: Object.keys(noPieceClient?.dna || {}).length === 0,
    pieces_count: piecesForNoPiece?.length,
  });

  // 2. Teste: Cliente criado COM peças
  const withPieceClientId = 'd0000000-0000-0000-0000-000000000020';
  const { error: withPieceErr } = await sb.from('clients').upsert({
    id: withPieceClientId,
    organization_id: orgId,
    name: 'Cliente Com Referências',
    slug: 'cliente-com-referencias',
    niche: 'Tecnologia',
    status: 'active',
    brand_status: 'collecting',
    visual_memory_status: 'awaiting_analysis',
    dna: {},
    manual_guidelines: 'Estética futurista com tipografia neo-grotesca.',
  });

  if (withPieceErr) throw withPieceErr;

  const testPieceWithId = 'e0000000-0000-0000-0000-000000000020';
  await sb.from('client_pieces').upsert({
    id: testPieceWithId,
    organization_id: orgId,
    client_id: withPieceClientId,
    title: 'Post Feed Inicial',
    original_filename: 'feed-tech.png',
    storage_bucket: 'client-pieces',
    storage_path: `${withPieceClientId}/feed-tech.png`,
    mime_type: 'image/png',
    format_type: 'feed',
    piece_type: 'own_brand',
    analysis_status: 'pending',
  });

  const { data: withPieceClient } = await sb
    .from('clients')
    .select('id, name, visual_memory_status')
    .eq('id', withPieceClientId)
    .single();

  const { data: piecesForWithPiece } = await sb
    .from('client_pieces')
    .select('id, title, analysis_status')
    .eq('client_id', withPieceClientId);

  console.log('Cliente com peças criado:', {
    name: withPieceClient?.name,
    visual_memory_status: withPieceClient?.visual_memory_status,
    pieces: piecesForWithPiece,
  });
}

main().catch(console.error);
