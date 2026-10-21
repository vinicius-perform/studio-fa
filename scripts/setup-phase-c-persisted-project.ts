// scripts/setup-phase-c-persisted-project.ts
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
import { CompositionService } from '../src/services/compositions/composition.service';
import { getFormatDefinition } from '../src/config/formats';

async function main() {
  console.log('=== CONFIGURANDO PROJETO PERSISTIDO COM ASSET REAL DA FASE C ===');
  const supabase = getServiceRoleClient();

  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const clientId = 'd0000000-0000-0000-0000-000000000020';
  const projectId = 'c0000000-0000-0000-0000-000000000001';
  const slideId = 'a0000000-0000-0000-0000-000000000001';
  const ownerUserId = '490e1088-6a65-42c0-a2bc-f39e57cd3253';

  // 1. Busca o asset já gerado no smoke da Fase C
  const { data: existingAsset, error: assetErr } = await supabase
    .from('client_assets')
    .select('*')
    .eq('id', 'e1f36afa-7532-4f0c-80c2-3580408b7297')
    .single();

  if (assetErr || !existingAsset) {
    throw new Error(`Asset real do smoke test não encontrado: ${assetErr?.message}`);
  }

  console.log(`[Asset] Encontrado: ${existingAsset.id} (${existingAsset.storage_path})`);

  // 2. Cria ou garante logo oficial da marca
  const logoPath = `${orgId}/${clientId}/logos/official_logo_alpha.png`;
  // Cria um PNG simples de 180x60 com transparência e texto estilizado
  const sampleLogoBase64 = 'iVBORw0KGgoAAAANSUhEUgAAALQAAAA8CAYAAADg3sU0AAAABmJLR0QA/wD/AP+gvaeTAAAAP0lEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAO4GoYQAAWcx4JAAAAAElFTkSuQmCC';
  const logoBuffer = Buffer.from(sampleLogoBase64, 'base64');

  await supabase.storage
    .from('client-brand-assets')
    .upload(logoPath, logoBuffer, { contentType: 'image/png', upsert: true });

  const { data: existingLogo } = await supabase
    .from('client_assets')
    .select('id')
    .eq('client_id', clientId)
    .eq('asset_type', 'logo_primary')
    .maybeSingle();

  let logoAssetId = existingLogo?.id;
  if (!logoAssetId) {
    const { data: insertedLogo } = await supabase
      .from('client_assets')
      .insert({
        organization_id: orgId,
        client_id: clientId,
        asset_type: 'logo_primary',
        label: 'Logo Oficial Alpha (Primário)',
        storage_bucket: 'client-brand-assets',
        storage_path: logoPath,
        original_filename: 'official_logo_alpha.png',
        mime_type: 'image/png',
        file_size_bytes: logoBuffer.length,
        width: 180,
        height: 60,
      } as any)
      .select('id')
      .single();
    logoAssetId = insertedLogo?.id;
  }

  console.log(`[Logo] Logo Oficial registrado: ${logoAssetId}`);

  // 3. Garante o Projeto na tabela 'projects'
  const { data: existingProj } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();

  if (!existingProj) {
    const { error: projInsertErr } = await supabase.from('projects').insert({
      id: projectId,
      organization_id: orgId,
      client_id: clientId,
      title: 'Estratégias de Alta Performance — Campanha Digital',
      project_type: 'single_post',
      status: 'draft',
      format: 'instagram_feed_4_5',
      width: 1080,
      height: 1350,
      brief: 'Ambiente executivo sofisticado com iluminação suave e textura refinada',
    } as any);

    if (projInsertErr) {
      throw new Error(`Falha ao inserir projeto: ${projInsertErr.message}`);
    }
  }

  console.log(`[Project] Projeto registrado: ${projectId}`);

  // 4. Garante a Lâmina na tabela 'project_slides'
  const { data: existingSlide } = await supabase
    .from('project_slides')
    .select('id')
    .eq('id', slideId)
    .maybeSingle();

  if (!existingSlide) {
    const { error: slideInsertErr } = await supabase.from('project_slides').insert({
      id: slideId,
      organization_id: orgId,
      project_id: projectId,
      slide_index: 0,
      slide_type: 'cover',
      title: 'ESTRATÉGIAS DE ALTA PERFORMANCE PARA SUA MARCA',
      subtitle: 'Como construir uma presença visual marcante e memorável no digital',
      body: 'Metodologia exclusiva de design orientado a resultados.',
      cta: 'Saiba Mais',
      status: 'draft',
    } as any);

    if (slideInsertErr) {
      throw new Error(`Falha ao inserir lâmina: ${slideInsertErr.message}`);
    }
  }

  console.log(`[Slide] Lâmina registrada: ${slideId}`);

  // 5. Gera Signed URLs para background e logo
  const bgSignedUrl = await StorageService.createSignedUrl(
    existingAsset.storage_bucket,
    existingAsset.storage_path,
    7200
  );

  const logoSignedUrl = await StorageService.createSignedUrl(
    'client-brand-assets',
    logoPath,
    7200
  );

  // 6. Constrói o Documento da Composição
  const compService = new CompositionService(supabase);
  const formatDef = getFormatDefinition('instagram_feed_4_5');

  const doc = await compService.initializeDefaultDocument({
    format: formatDef,
    content: {
      title: 'ESTRATÉGIAS DE ALTA PERFORMANCE PARA SUA MARCA',
      subtitle: 'Como construir uma presença visual marcante e memorável no digital',
      body: 'Metodologia exclusiva de design orientado a resultados.',
      cta: 'Saiba Mais',
    },
    clientLogoUrl: logoSignedUrl || undefined,
    backgroundUrl: bgSignedUrl || undefined,
    backgroundAssetId: existingAsset.id,
  });

  // 7. Persiste a Composição no Supabase
  const savedComp = await compService.saveComposition({
    slideId,
    projectId,
    organizationId: orgId,
    document: doc,
    expectedRevision: 1,
    userId: ownerUserId,
  });

  console.log(`[Composition] Composição persistida com sucesso! Revision: ${savedComp.revision}`);
  console.log(`[Composition] Total de camadas: ${doc.layers.length}`);
  doc.layers.forEach((l) => console.log(`  - Camada [${l.id}] (${l.type}): ${l.name}`));

  console.log('\n=== PROJETO CONFIGURADO COM SUCESSO PARA TESTE DE REABERTURA ===');
  console.log(`Acesse: http://localhost:3000/projects/${projectId}`);
}

main().catch((err) => {
  console.error('ERRO:', err);
  process.exit(1);
});
