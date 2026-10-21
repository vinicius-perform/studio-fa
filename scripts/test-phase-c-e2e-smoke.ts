// scripts/test-phase-c-e2e-smoke.ts
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Carrega variáveis de ambiente do .env.local
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

import { CreativeContextService } from '../src/services/ai/creative-context.service';
import { ImageGenerationService } from '../src/services/ai/image-generation.service';
import { CompositionService } from '../src/services/compositions/composition.service';
import { getFormatDefinition } from '../src/config/formats';
import { getServiceRoleClient } from '../src/lib/supabase/server';

async function runE2ESmoke() {
  console.log('=== INICIANDO TESTE E2E REAL SMOKE (FASE C) ===');
  console.log('Configuração: gpt-image-2.5-flare, quality: low, n: 1, 1 slide, 4:5, 1 referência real');

  const supabase = getServiceRoleClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const clientId = 'd0000000-0000-0000-0000-000000000020';

  // 1. Busca peça de referência real do cliente
  const { data: pieces, error: pieceErr } = await supabase
    .from('client_pieces')
    .select('id, title, storage_bucket, storage_path, analysis_json')
    .eq('client_id', clientId)
    .limit(1);

  if (pieceErr || !pieces || pieces.length === 0) {
    throw new Error(`Nenhuma peça de referência encontrada para o cliente de teste: ${pieceErr?.message}`);
  }

  const primaryPiece = pieces[0];
  console.log(`[Referência] Peça encontrada: "${primaryPiece.title}" (ID: ${primaryPiece.id})`);
  console.log(`[Referência] Storage: ${primaryPiece.storage_bucket}/${primaryPiece.storage_path}`);

  // 2. Constrói CreativeContext
  const contextService = new CreativeContextService(supabase);
  const slideId = `slide-smoke-${Date.now()}`;
  const projectId = `proj-smoke-${Date.now()}`;
  const exactTitle = 'ESTRATÉGIAS DE ALTA PERFORMANCE PARA SUA MARCA';
  const exactSubtitle = 'Como construir uma presença visual marcante e memorável no digital';
  const exactCta = 'Saiba Mais';

  console.log('[CreativeContext] Construindo contexto com anti-text baking e resolução de marca...');
  const creativeContext = await contextService.buildContext({
    organizationId: orgId,
    clientId,
    projectId,
    slideIndex: 0,
    formatId: 'instagram_feed_4_5',
    content: {
      title: exactTitle,
      subtitle: exactSubtitle,
      body: 'Metodologia exclusiva de design orientado a resultados.',
      cta: exactCta,
      userVisualDirection: 'Ambiente executivo sofisticado com iluminação suave e textura refinada',
    },
    selectedReferenceIds: [primaryPiece.id],
    primaryReferenceId: primaryPiece.id,
  });

  console.log('[CreativeContext] Contexto validado com sucesso.');
  console.log(`[CreativeContext] Formato: ${creativeContext.format.name} (${creativeContext.format.aspectRatio})`);
  console.log(`[CreativeContext] Dimensões GPT Image: ${creativeContext.format.generationWidth}x${creativeContext.format.generationHeight}`);
  console.log(`[CreativeContext] Regras Manuais vinculadas: ${creativeContext.manualRules.length}`);

  // 3. Dispara a ÚNICA geração real autorizada no perfil SMOKE
  const imageGenService = new ImageGenerationService(supabase);
  console.log('[GPT Image] Disparando chamada real para a OpenAI (gpt-image-2.5-flare, low, edits multipart)...');
  const startTime = Date.now();

  const generatedAsset = await imageGenService.generateSlideVisual({
    context: creativeContext,
    slideId,
    projectId,
    profile: 'SMOKE',
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[GPT Image] Resposta recebida com sucesso em ${durationSec}s!`);
  console.log(`[GeneratedAsset] ID: ${generatedAsset.id}`);
  console.log(`[GeneratedAsset] Model: ${generatedAsset.model}`);
  console.log(`[GeneratedAsset] Storage: ${generatedAsset.storageBucket}/${generatedAsset.storagePath}`);
  console.log(`[GeneratedAsset] Signed URL: ${generatedAsset.publicOrSignedUrl.slice(0, 80)}...`);

  // 4. Validação da Imagem (Decodificação e Integridade)
  const { data: downloadedBlob, error: dlErr } = await supabase.storage
    .from(generatedAsset.storageBucket)
    .download(generatedAsset.storagePath);

  if (dlErr || !downloadedBlob) {
    throw new Error(`Falha ao baixar imagem gerada do Storage: ${dlErr?.message}`);
  }

  const arrayBuf = await downloadedBlob.arrayBuffer();
  const imgBuffer = Buffer.from(arrayBuf);
  console.log(`[Validação] Tamanho do arquivo salvo: ${(imgBuffer.length / 1024).toFixed(1)} KB`);

  // Verifica magic bytes (PNG: 89 50 4E 47 ou JPEG: FF D8)
  const isPng = imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50 && imgBuffer[2] === 0x4e && imgBuffer[3] === 0x47;
  const isJpg = imgBuffer[0] === 0xff && imgBuffer[1] === 0xd8;
  console.log(`[Validação] Formato de imagem detectado: ${isPng ? 'PNG (Magic Bytes OK)' : isJpg ? 'JPEG (Magic Bytes OK)' : 'Outro'}`);

  if (!isPng && !isJpg) {
    throw new Error('O arquivo gravado no storage não é uma imagem válida (magic bytes corrompidos).');
  }

  // 5. Constrói composição com layers editáveis
  console.log('[CompositionBuilder] Montando composição editável para o Konva Studio...');
  const compService = new CompositionService(supabase);
  const formatDef = getFormatDefinition('instagram_feed_4_5');
  const compositionDoc = await compService.initializeDefaultDocument({
    format: formatDef,
    content: {
      title: exactTitle,
      subtitle: exactSubtitle,
      body: 'Metodologia exclusiva de design orientado a resultados.',
      cta: exactCta,
    },
    backgroundUrl: generatedAsset.publicOrSignedUrl,
  });

  // Validação de fidelidade de layers
  const bgLayer = compositionDoc.layers.find((l) => l.id === 'layer-bg') as any;
  const titleLayer = compositionDoc.layers.find((l) => l.id === 'layer-title') as any;
  const subLayer = compositionDoc.layers.find((l) => l.id === 'layer-subtitle') as any;
  const ctaLayer = compositionDoc.layers.find((l) => l.id === 'layer-cta-text') as any;

  console.log(`[Layers] Background Layer: ${bgLayer ? 'PRESENTE' : 'AUSENTE'} (${bgLayer?.imageUrl ? 'URL VÁLIDA' : 'SEM URL'})`);
  console.log(`[Layers] Title Layer: "${titleLayer?.text}" (Exatamente igual ao input: ${titleLayer?.text === exactTitle ? 'SIM' : 'NÃO'})`);
  console.log(`[Layers] Subtitle Layer: "${subLayer?.text}" (Exatamente igual ao input: ${subLayer?.text === exactSubtitle ? 'SIM' : 'NÃO'})`);
  console.log(`[Layers] CTA Layer: "${ctaLayer?.text}" (Exatamente igual ao input: ${ctaLayer?.text === exactCta ? 'SIM' : 'NÃO'})`);

  if (titleLayer?.text !== exactTitle || ctaLayer?.text !== exactCta) {
    throw new Error('Falha de fidelidade ao conteúdo: texto nas layers editáveis diverge do input do usuário!');
  }

  console.log('\n=== RESULTADO DO TESTE E2E REAL SMOKE: PASS (100% SUCESSO) ===\n');
}

runE2ESmoke().catch((err) => {
  console.error('\n=== FALHA NO TESTE E2E REAL SMOKE ===');
  console.error(err);
  process.exit(1);
});
