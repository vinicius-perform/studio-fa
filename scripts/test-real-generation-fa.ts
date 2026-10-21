import fs from 'fs';
import path from 'path';

// Carrega .env.local
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

async function runRealTest() {
  console.log('=== TESTE REAL: GERAÇÃO ORIENTADA POR MEMÓRIA VISUAL (FAZENDO ACONTECER) ===');
  const supabase = getServiceRoleClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const clientId = 'c14b4641-620f-463a-9afb-0352c978974c'; // Fazendo Acontecer

  // 1. Busca as 13 peças de Fazendo Acontecer e seleciona 12 (como na UI)
  const { data: pieces, error: pErr } = await supabase
    .from('client_pieces')
    .select('id, title, storage_path')
    .eq('client_id', clientId);

  if (pErr || !pieces || pieces.length === 0) {
    throw new Error(`Peças não encontradas para o cliente: ${pErr?.message}`);
  }

  const selected12 = pieces.slice(0, 12).map((p) => p.id);
  console.log(`Total de peças do cliente: ${pieces.length}. Peças selecionadas para o teste: ${selected12.length}.`);

  // 2. Executa a geração oficial através do CreativeChatService
  const chatService = new CreativeChatService(supabase);
  const prompt = 'Crie um post 4:5 com a headline: 15 mensagens para sua secretária recuperar paciente perdido. Siga rigorosamente a identidade visual das referências.';

  console.log(`Iniciando geração real com o prompt: "${prompt}"...`);
  const startTime = Date.now();

  const piece = await chatService.generateChatPiece({
    organizationId: orgId,
    clientId,
    userId: '490e1088-6a65-42c0-a2bc-f39e57cd3253', // Usuário admin do sistema
    userMessage: prompt,
    selectedPieceIds: selected12,
    profile: 'FINAL', // Gera com modelo de alta fidelidade
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('=== GERAÇÃO REAL CONCLUÍDA COM SUCESSO! ===');
  console.log(`Duração: ${durationSec}s`);
  console.log('Projeto ID:', piece.projectId);
  console.log('Slide ID:', piece.slideId);
  console.log('Modelo utilizado:', piece.modelUsed);
  console.log('Aspect Ratio:', piece.aspectRatio);
  console.log('Active References Count:', piece.activeReferencesCount);
  console.log('Preview URL:', piece.previewUrl);

  // Salva localmente para auditoria visual se for data URL ou baixa se for URL
  if (piece.previewUrl.startsWith('data:image/svg')) {
    console.log('AVISO: Retornou SVG fallback.');
  } else if (piece.previewUrl.startsWith('data:image')) {
    const base64Data = piece.previewUrl.split(',')[1];
    const outPath = path.resolve(process.cwd(), 'test-real-fa-output.png');
    fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
    console.log(`Imagem salva em: ${outPath}`);
  } else if (piece.previewUrl.startsWith('http')) {
    console.log('Baixando imagem gerada para salvar cópia local...');
    const resp = await fetch(piece.previewUrl);
    const buf = Buffer.from(await resp.arrayBuffer());
    const outPath = path.resolve(process.cwd(), 'test-real-fa-output.png');
    fs.writeFileSync(outPath, buf);
    console.log(`Imagem oficial salva em: ${outPath} (${buf.length} bytes)`);
  }
}

runRealTest().catch((err: any) => {
  console.log('ERRO NO TESTE REAL - MSG:', err?.message || String(err));
  if (err?.stack) console.log('STACK:', err.stack);
  process.exit(1);
});
