import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { VisualAnalyzerService } from '../src/services/ai/visual-analyzer.service';
import { IntegrationService } from '../src/services/integrations/integration.service';
import { BrandDNAService } from '../src/services/ai/brand-dna.service';
import { PieceAnalysisSchema } from '../src/types/domain/piece';
import { BrandDNASchema } from '../src/types/domain/dna';

// 1. Carrega variáveis de ambiente
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== TESTE REAL END-TO-END DA OPENAI VISION & DNA (SEM MOCK) ===');
  const startTime = Date.now();

  // 1. Identificar Organização
  const { data: orgs } = await sb.from('organizations').select('id, name').limit(1);
  const org = orgs?.[0];
  if (!org) {
    throw new Error('Nenhuma organização encontrada para o teste.');
  }
  console.log(`Organização ativa: ${org.name} (${org.id})`);

  // 2. Resolver chave e modelo OpenAI via IntegrationService
  const integrationService = new IntegrationService(sb);
  const apiKey = await integrationService.resolveOpenAIKey(org.id);
  const resolvedModel = await integrationService.resolveOpenAIModel(org.id, 'vision');
  console.log(`Chave OpenAI resolvida com sucesso: sk-...${apiKey.slice(-4)}`);
  console.log(`Modelo OpenAI resolvido: ${resolvedModel}`);

  // 3. Garantir Cliente de Teste no banco
  const testClientId = 'd0000000-0000-0000-0000-000000000001';
  const { error: clientUpsertErr } = await sb.from('clients').upsert({
    id: testClientId,
    organization_id: org.id,
    name: 'Ateliê FA Elegance',
    slug: 'atelie-fa-elegance',
    niche: 'Alta Costura & Joalheria',
    manual_guidelines: 'Marca de luxo com preto e dourado nobre, tipografia serifa refinada e fotos com iluminação editorial suave.',
    status: 'active',
    brand_status: 'analyzing',
    visual_memory_status: 'analyzing',
  });

  if (clientUpsertErr) {
    throw new Error(`Falha ao preparar cliente de teste: ${clientUpsertErr.message}`);
  }
  console.log(`Cliente de teste provisionado no Supabase: Ateliê FA Elegance (${testClientId})`);

  // 4. Imagem real de teste
  const imagePath = 'C:\\Users\\vinic\\.gemini\\antigravity\\brain\\cbd65322-2cd9-42da-9c34-5970f53e0c6b\\.user_uploaded\\media_1792257018620_2d1001f3.png';
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Imagem real não encontrada em ${imagePath}`);
  }
  const imageBuffer = fs.readFileSync(imagePath);
  console.log(`Imagem real carregada: ${imagePath} (${imageBuffer.length} bytes)`);

  // 5. Upload para Storage (bucket client-pieces)
  const filename = `test-e2e-${Date.now()}.png`;
  const storagePath = `${testClientId}/${filename}`;
  const { error: uploadErr } = await sb.storage
    .from('client-pieces')
    .upload(storagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Falha ao subir imagem para Storage: ${uploadErr.message}`);
  }
  console.log(`Upload para bucket 'client-pieces' concluído com sucesso: ${storagePath}`);

  // 6. Execução da Análise Visual Real via VisualAnalyzerService
  console.log('Chamando VisualAnalyzerService.analyzePiece com OpenAI multimodal real...');
  const testPieceId = 'e0000000-0000-0000-0000-000000000001';

  const analysisResult = await VisualAnalyzerService.analyzePiece({
    organizationId: org.id,
    clientId: testClientId,
    pieceId: testPieceId,
    filename,
    storageBucket: 'client-pieces',
    storagePath,
    mimeType: 'image/png',
    width: 1080,
    height: 1080,
    aspectRatio: 1.0,
    formatType: 'feed',
    pieceType: 'own_brand',
    clientInfo: {
      name: 'Ateliê FA Elegance',
      niche: 'Alta Costura & Joalheria',
      manualGuidelines: 'Marca de luxo com preto e dourado nobre, tipografia serifa refinada e fotos com iluminação editorial suave.',
    },
  });

  const durationMs = Date.now() - startTime;

  // 7. Validação estrita do Schema
  const schemaValidation = PieceAnalysisSchema.safeParse(analysisResult.analysis);

  console.log('\n================ RESULTADOS DA ANÁLISE VISUAL ================');
  console.log(`STATUS: REAL OPENAI VISUAL ANALYSIS: ${schemaValidation.success ? 'PASS' : 'FAIL'}`);
  console.log(`Modelo real utilizado: ${analysisResult.model}`);
  console.log(`Versão do prompt: ${analysisResult.promptVersion}`);
  console.log(`Tempo de resposta: ${durationMs}ms`);
  console.log(`Validação do Schema Zod: ${schemaValidation.success ? 'VÁLIDO (100% conforme)' : 'INVÁLIDO'}`);
  if (!schemaValidation.success) {
    console.error('Erros de validação Zod:', schemaValidation.error.format());
    process.exit(1);
  }

  console.log('\n--- DADOS REAIS EXTRAÍDOS DA IMAGEM ---');
  console.log(`Resumo: ${analysisResult.analysis.summary}`);
  console.log(`Paleta Detectada: Primária=${analysisResult.analysis.colors.primary}, Secundária=${analysisResult.analysis.colors.secondary}, Destaque=${analysisResult.analysis.colors.accent}`);
  console.log(`Tipografia: Estilo=${analysisResult.analysis.typography.primaryStyle}, Peso=${analysisResult.analysis.typography.titleWeight}`);
  console.log(`Composição: Layout=${analysisResult.analysis.composition.layoutStyle}, Densidade=${analysisResult.analysis.composition.density}`);
  console.log(`Quality Score: ${analysisResult.analysis.qualityScore}/10 (Confiança: ${analysisResult.analysis.confidence})`);

  // 8. Persistência real em client_pieces
  const { error: insertPieceErr } = await sb.from('client_pieces').upsert({
    id: testPieceId,
    organization_id: org.id,
    client_id: testClientId,
    title: 'Peça de Validação E2E Real',
    original_filename: filename,
    storage_bucket: 'client-pieces',
    storage_path: storagePath,
    file_size_bytes: imageBuffer.length,
    mime_type: 'image/png',
    width: 1080,
    height: 1080,
    aspect_ratio: 1.0,
    format_type: 'feed',
    piece_type: 'own_brand',
    analysis_status: 'completed',
    analysis_json: analysisResult.analysis as any,
    analysis_model: analysisResult.model,
    analysis_prompt_version: analysisResult.promptVersion,
    quality_score: analysisResult.analysis.qualityScore,
    analyzed_at: new Date().toISOString(),
  });

  if (insertPieceErr) {
    throw new Error(`Falha ao persistir em client_pieces: ${insertPieceErr.message}`);
  }
  console.log(`\nPersistência em client_pieces: SUCESSO! (ID: ${testPieceId})`);

  // 9. Consolidação do Brand DNA Real
  console.log('\nIniciando consolidação real do Brand DNA com OpenAI...');
  const consolidatedDNA = await BrandDNAService.consolidateDNA({
    organizationId: org.id,
    clientId: testClientId,
    clientName: 'Ateliê FA Elegance',
    clientNiche: 'Alta Costura & Joalheria',
    manualGuidelines: 'Marca de luxo com preto e dourado nobre, tipografia serifa refinada e fotos com iluminação editorial suave.',
    brandIdentity: {
      primaryColor: analysisResult.analysis.colors.primary,
      secondaryColor: analysisResult.analysis.colors.secondary,
      accentColor: analysisResult.analysis.colors.accent,
      primaryFont: 'Cinzel',
      secondaryFont: 'Montserrat',
    },
    piecesAnalyses: [
      {
        pieceId: testPieceId,
        pieceType: 'own_brand',
        formatType: 'feed',
        analysis: analysisResult.analysis,
      },
    ],
  });

  const dnaValidation = BrandDNASchema.safeParse(consolidatedDNA);
  console.log(`Validação do BrandDNASchema: ${dnaValidation.success ? 'PASS (100% conforme)' : 'FAIL'}`);
  if (!dnaValidation.success) {
    throw new Error(`Brand DNA inválido: ${dnaValidation.error.message}`);
  }

  // 10. Persistência em brand_dna_versions e snapshot em clients.dna
  const saveResult = await BrandDNAService.saveConsolidatedDNA(testClientId, org.id, consolidatedDNA, {
    sourcePieceIds: [testPieceId],
    model: resolvedModel,
    promptVersion: '2.0.0',
  });

  console.log(`Brand DNA versionado com sucesso: Versão ${saveResult.version}`);

  // 11. Conferência final dos dados persistidos remotamente
  const { data: verifiedPiece } = await sb
    .from('client_pieces')
    .select('id, analysis_status, analysis_model, analysis_prompt_version, quality_score')
    .eq('id', testPieceId)
    .single();

  const { data: verifiedDNAVersion } = await sb
    .from('brand_dna_versions')
    .select('id, version, status, source_piece_ids, model')
    .eq('client_id', testClientId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const { data: verifiedClient } = await sb
    .from('clients')
    .select('id, visual_memory_status, brand_status, dna')
    .eq('id', testClientId)
    .single();

  console.log('\n================ CONFERÊNCIA REMOTA SUPABASE ================');
  console.log('client_pieces verificado:', verifiedPiece);
  console.log('brand_dna_versions verificado:', verifiedDNAVersion);
  console.log('clients snapshot verificado:', {
    id: verifiedClient?.id,
    visual_memory_status: verifiedClient?.visual_memory_status,
    brand_status: verifiedClient?.brand_status,
    dna_summary: (verifiedClient?.dna as any)?.summary?.substring(0, 80) + '...',
  });

  console.log('\n>>> TODAS AS VALIDAÇÕES END-TO-END CONCLUÍDAS COM SUCESSO IRRESTRITO! <<<');
}

main().catch((err) => {
  console.error('\nSTATUS: REAL OPENAI VISUAL ANALYSIS: FAIL');
  console.error('Erro na execução:', err);
  process.exit(1);
});
