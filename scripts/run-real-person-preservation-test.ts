// scripts/run-real-person-preservation-test.ts
import fs from 'node:fs';
import path from 'node:path';

// Carrega .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  console.warn('Erro ao ler .env.local:', e);
}

import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';

async function run() {
  const supabase = getSupabaseAdminClient();
  const chatService = new CreativeChatService(supabase);

  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const clientId = 'c14b4641-620f-463a-9afb-0352c978974c'; // Fazendo Acontecer
  const userId = '490e1088-6a65-42c0-a2bc-f39e57cd3253';
  const selectedPieceId = '906d686e-10e5-4259-8206-50a0ddff9b9f';

  const subjectPhotoPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/.user_uploaded/media_1792525732743_c86dda60.png';
  const subjectBuffer = fs.readFileSync(subjectPhotoPath);

  console.log('--- TESTE REAL: PRESERVAÇÃO EXATA DA PESSOA (MODO 2) ---');
  console.log('Cliente: Fazendo Acontecer');
  console.log('Estilo da Arte (Referência):', selectedPieceId);
  console.log('Objeto Principal (Foto da Pessoa):', subjectPhotoPath, `(${subjectBuffer.length} bytes)`);
  console.log('Modo de Fidelidade:', 'preserve_person');

  const piece = await chatService.generateChatPiece({
    organizationId: orgId,
    clientId,
    userId,
    userMessage: 'Crie um post de autoridade médica para a Dra. especialista com design elegante e moderno.',
    selectedPieceIds: [selectedPieceId],
    format: 'instagram_feed_4_5',
    aspectRatio: '4:5',
    projectType: 'single_post',
    profile: 'SMOKE',
    subjectPhotoUrl: `data:image/png;base64,${subjectBuffer.toString('base64')}`,
    personHandlingMode: 'preserve_person',
  });

  console.log('\n[Resultado do Pipeline de Preservação]');
  console.log('Peça gerada com sucesso!');
  console.log('Preview URL:', piece.previewUrl);

  if (piece.previewUrl.startsWith('http')) {
    const res = await fetch(piece.previewUrl);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const outPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-real-person-preserved-final.png';
    fs.writeFileSync(outPath, buffer);
    console.log('Arte final com preservação real salva em:', outPath);
  }

  return piece;
}

run().catch((err) => {
  console.error('ERRO NO TESTE REAL DE PRESERVAÇÃO:', err);
  process.exit(1);
});
