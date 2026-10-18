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
  const testClientId = 'd0000000-0000-0000-0000-000000000001';
  const testPieceId = 'e0000000-0000-0000-0000-000000000001';

  // 1. Simula o comportamento do endpoint quando a OpenAI retorna credit_balance_exhausted
  const errorMessage = 'OpenAI Vision API retornou status 429: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.';

  await sb.from('client_pieces').upsert({
    id: testPieceId,
    organization_id: 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6',
    client_id: testClientId,
    title: 'Peça de Teste de Crédito E2E',
    original_filename: 'teste-credito.png',
    storage_bucket: 'client-pieces',
    storage_path: `${testClientId}/teste.png`,
    mime_type: 'image/png',
    format_type: 'feed',
    piece_type: 'own_brand',
    analysis_status: 'failed',
    analysis_error: errorMessage,
    analysis_model: 'gpt-4o',
    analysis_prompt_version: '2.0.0',
    updated_at: new Date().toISOString(),
  });

  await sb.from('clients').update({
    visual_memory_status: 'needs_review',
    brand_status: 'needs_review',
    updated_at: new Date().toISOString(),
  }).eq('id', testClientId);

  const { data: piece } = await sb.from('client_pieces').select('*').eq('id', testPieceId).single();
  const { data: client } = await sb.from('clients').select('id, name, visual_memory_status, brand_status').eq('id', testClientId).single();

  console.log('client_pieces registrado:', {
    id: piece?.id,
    analysis_status: piece?.analysis_status,
    analysis_error: piece?.analysis_error,
  });
  console.log('client atualizado:', client);
}

main().catch(console.error);
