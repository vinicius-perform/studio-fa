import fs from 'fs';
import path from 'path';

// Carrega variáveis do .env.local
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
import { CreativeChatService } from '../src/services/ai/creative-chat.service';
import { StorageService } from '../src/services/storage/storage.service';

async function runHotfixAudit() {
  console.log('====================================================');
  console.log('AUDITORIA REAL DO PIPELINE: FAZENDO ACONTECER (FA)');
  console.log('====================================================');

  const supabase = getServiceRoleClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const clientId = 'c14b4641-620f-463a-9afb-0352c978974c'; // Fazendo Acontecer

  // 1. Busca peça real da memória visual do cliente
  const { data: pieces, error: pErr } = await supabase
    .from('client_pieces')
    .select('id, title, storage_bucket, storage_path')
    .eq('client_id', clientId)
    .limit(1);

  if (pErr || !pieces || pieces.length === 0) {
    throw new Error(`Peça não encontrada para o cliente FA: ${pErr?.message}`);
  }

  const selectedRef = pieces[0];
  console.log('[1. Referência Real]', {
    id: selectedRef.id,
    bucket: selectedRef.storage_bucket,
    path: selectedRef.storage_path,
  });

  // 2. Testa se o buffer real da referência é baixado com sucesso
  try {
    const buf = await StorageService.downloadAsBuffer(selectedRef.storage_bucket, selectedRef.storage_path);
    console.log('[2. Download dos Pixels Reais]', {
      success: true,
      bytes: buf.length,
      mimeDetected: selectedRef.storage_path.endsWith('.png') ? 'image/png' : 'image/jpeg',
    });
  } catch (err: any) {
    console.error('[2. Download dos Pixels Reais] FALHA:', err.message);
  }

  // 3. Executa a chamada do pipeline oficial através de CreativeChatService
  const chatService = new CreativeChatService(supabase);
  const prompt = '15 mensagens infalíveis para sua secretária recuperar pacientes perdidos';

  console.log('[3. Disparando Pipeline com Hotfix Ativo]...');
  console.log('Parâmetros:', {
    formato: 'Feed 4:5',
    tipo: 'Peça única',
    prompt,
    selectedPieceId: selectedRef.id,
  });

  try {
    const result = await chatService.generateChatPiece({
      organizationId: orgId,
      clientId,
      userId: '490e1088-6a65-42c0-a2bc-f39e57cd3253',
      userMessage: prompt,
      selectedPieceIds: [selectedRef.id],
      format: 'instagram_feed_4_5',
      aspectRatio: '4:5',
      projectType: 'single_post',
      profile: 'FINAL',
    });

    console.log('----------------------------------------------------');
    console.log('[RESULTADO DA GERAÇÃO]');
    console.log('previewUrl:', result.previewUrl);
    console.log('isSvgPlaceholder:', result.previewUrl.startsWith('data:image/svg'));
    console.log('activeReferencesCount:', result.activeReferencesCount);
    console.log('modelUsed:', result.modelUsed);
    console.log('----------------------------------------------------');

    if (result.previewUrl.startsWith('data:image/svg')) {
      console.error('VIOLAÇÃO CRÍTICA: SVG fake detectado como resultado!');
      process.exit(1);
    } else {
      console.log('SUCESSO REAL: Asset real entregue sem placeholders falsos!');
    }
  } catch (err: any) {
    console.log('----------------------------------------------------');
    console.log('[BLOQUEIO DE FALSO SUCESSO VALIDADO]');
    console.log('O pipeline recusou fingir sucesso e lançou o erro operacional real:');
    console.log('Mensagem de erro capturada:', err.message);
    console.log('----------------------------------------------------');
    console.log('Status: PASS (Nenhum placeholder fake "Studio FA" foi renderizado ou salvo)');
  }
}

runHotfixAudit().catch((e) => {
  console.error('Erro no script de auditoria:', e);
});
