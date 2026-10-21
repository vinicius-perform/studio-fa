// scripts/validate-project-reopen.ts
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
import { StorageService } from '../src/services/storage/storage.service';

async function validateProjectReopen() {
  console.log('=== TESTE DE REABERTURA E PERSISTÊNCIA REAL (DB/API -> KONVA) ===');
  const supabase = getServiceRoleClient();
  const projectId = 'c0000000-0000-0000-0000-000000000001';

  // 1. Simula a chamada GET que o frontend faz ao carregar a página /projects/[id]
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('*, client:clients(id, name, slug, brand_status)')
    .eq('id', projectId)
    .single();

  if (pErr || !project) {
    throw new Error(`Projeto ${projectId} não encontrado no banco: ${pErr?.message}`);
  }
  console.log(`[Reabertura] Projeto carregado: "${project.title}" (Status: ${project.status}, Formato: ${project.format})`);

  // 2. Busca slides
  const { data: slides, error: sErr } = await supabase
    .from('project_slides')
    .select('*')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });

  if (sErr || !slides || slides.length === 0) {
    throw new Error(`Nenhuma lâmina encontrada para o projeto: ${sErr?.message}`);
  }
  console.log(`[Reabertura] Lâminas encontradas: ${slides.length} lâmina(s)`);

  // 3. Busca composições persistidas (Simula refresh real: lê direto da base)
  const slideIds = slides.map((s) => s.id);
  const { data: compositions, error: cErr } = await supabase
    .from('slide_compositions')
    .select('*')
    .in('slide_id', slideIds);

  if (cErr || !compositions || compositions.length === 0) {
    throw new Error(`Composição não encontrada na tabela slide_compositions: ${cErr?.message}`);
  }

  const comp = compositions[0];
  const doc = comp.document as any;
  console.log(`[Reabertura] Composição carregada do DB! Revisão: ${comp.revision}`);
  console.log(`[Reabertura] Canvas: ${doc.canvas.width}x${doc.canvas.height} (${doc.canvas.format})`);

  // 4. Inspeciona cada camada retornada do DB
  const bgLayer = doc.layers.find((l: any) => l.id === 'layer-bg');
  const logoLayer = doc.layers.find((l: any) => l.id === 'layer-logo');
  const titleLayer = doc.layers.find((l: any) => l.id === 'layer-title');
  const subtitleLayer = doc.layers.find((l: any) => l.id === 'layer-subtitle');
  const ctaBgLayer = doc.layers.find((l: any) => l.id === 'layer-cta-bg');
  const ctaTextLayer = doc.layers.find((l: any) => l.id === 'layer-cta-text');

  console.log('\n--- AUDITORIA DE CAMADAS APÓS REFRESH (PERSISTÊNCIA REAL) ---');
  console.log(`1. Background Layer: ${bgLayer ? 'OK' : 'FAIL'}`);
  console.log(`   - URL: ${bgLayer?.imageUrl ? bgLayer.imageUrl.slice(0, 70) + '...' : 'N/A'}`);
  console.log(`   - AssetId vinculado: ${bgLayer?.assetId}`);
  console.log(`   - Fit: ${bgLayer?.fit}`);

  console.log(`2. Logo Oficial Layer: ${logoLayer ? 'OK' : 'FAIL'}`);
  console.log(`   - URL: ${logoLayer?.logoUrl ? logoLayer.logoUrl.slice(0, 70) + '...' : 'N/A'}`);
  console.log(`   - AspectRatio: ${logoLayer?.aspectRatio}`);
  console.log(`   - Dimensões: ${logoLayer?.width}x${logoLayer?.height}`);

  console.log(`3. Headline Layer: ${titleLayer ? 'OK' : 'FAIL'}`);
  console.log(`   - Texto exato: "${titleLayer?.text}"`);
  console.log(`   - Fonte: ${titleLayer?.fontFamily}, Tamanho: ${titleLayer?.fontSize}px`);

  console.log(`4. Supporting Text Layer: ${subtitleLayer ? 'OK' : 'FAIL'}`);
  console.log(`   - Texto exato: "${subtitleLayer?.text}"`);

  console.log(`5. CTA Layer: ${ctaTextLayer ? 'OK' : 'FAIL'}`);
  console.log(`   - Texto exato: "${ctaTextLayer?.text}"`);
  console.log(`   - Botão Fundo: ${ctaBgLayer?.fillColor} (${ctaBgLayer?.width}x${ctaBgLayer?.height}px)`);

  if (!bgLayer || !logoLayer || !titleLayer || !subtitleLayer || !ctaTextLayer) {
    throw new Error('Uma ou mais camadas obrigatórias estão faltando após o refresh!');
  }

  // 5. Validação de rastreabilidade do background persistido até o client_assets
  const { data: assetRow, error: aErr } = await supabase
    .from('client_assets')
    .select('*')
    .eq('id', bgLayer.assetId)
    .single();

  if (aErr || !assetRow) {
    throw new Error(`Asset ${bgLayer.assetId} vinculado à camada de fundo não encontrado em client_assets!`);
  }

  console.log('\n--- RASTREABILIDADE DO ASSET GERADO ---');
  console.log(`Asset ID:        ${assetRow.id}`);
  console.log(`Storage Path:    ${assetRow.storage_bucket}/${assetRow.storage_path}`);
  const meta = assetRow.metadata as any;
  console.log(`Modelo:          ${meta?.model}`);
  console.log(`Provider:        ${meta?.provider}`);
  console.log(`Perfil:          ${meta?.generationProfile}`);
  console.log(`Prompt Version:  ${meta?.promptVersion}`);
  console.log(`Project ID:      ${meta?.projectId}`);
  console.log(`Slide ID:        ${meta?.slideId}`);

  console.log('\n=== RESULTADO: REABERTURA E REFRESH HOMOLOGADOS COM SUCESSO (PASS) ===\n');
}

validateProjectReopen().catch((err) => {
  console.error('FALHA:', err);
  process.exit(1);
});
