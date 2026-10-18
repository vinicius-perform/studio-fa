import fs from 'fs';
import path from 'path';

// 1. Carrega todas as variáveis no process.env antes de importar serviços
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
import { BrandDNAService } from '../src/services/ai/brand-dna.service';
import { BrandDNA, BrandDNASchema } from '../src/types/domain/dna';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(supabaseUrl, serviceKey);

async function main() {
  const testClientId = 'd0000000-0000-0000-0000-000000000001';
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const testPieceId = 'e0000000-0000-0000-0000-000000000001';

  const sampleDNA: BrandDNA = {
    version: 1,
    lastConsolidatedAt: new Date().toISOString(),
    analyzedPiecesCount: 1,
    summary: 'Identidade sofisticada de alta joalheria com estética minimalista e alto contraste.',
    toneAndVoice: 'Luxuoso, refinado, sóbrio e elegante',
    colorSystem: {
      primary: '#0F1113',
      secondary: '#D4AF37',
      accent: '#FFFFFF',
      neutrals: ['#0F1113', '#1C1E21'],
      distributionRules: '70% preto profundo, 20% dourado nobre, 10% destaques brancos',
      allowedCombinations: ['Fundo preto com tipografia dourada ou branca'],
      forbiddenCombinations: ['Cores saturadas neon ou gradientes arco-íris'],
    },
    typography: {
      titleFont: 'Cinzel',
      bodyFont: 'Montserrat',
      hierarchyGuidelines: 'Títulos em caixa alta serifada com respiro amplo',
      caseRules: 'Títulos em UPPERCASE e subtítulos em Sentence case',
    },
    composition: {
      dominantLayout: 'Centralizado editorial com respiro amplo',
      whiteSpaceRule: 'Mínimo de 40px de área livre nas bordas',
      visualDensity: 'low',
      focalPointGuideline: 'Foco no produto ou joia com iluminação direcional sutil',
    },
    imagery: {
      photoStyle: 'Fotografia macro de estúdio com fundo escuro',
      subjectTreatment: 'Recorte suave com sombra natural realista',
      lightingPreference: 'Luz direcional de estúdio de alta precisão',
      mockupOrIllustrationUsage: 'Apenas renders fotorrealistas',
    },
    graphicElements: {
      allowedElements: ['Linhas douradas de 1px', 'Molduras finas clássicas'],
      bannedElements: ['Bolinhas coloridas', 'Sombras borradas pesadas'],
      textureGuidelines: 'Superfícies limpas com sutil granulação nobre',
    },
    logoRules: {
      preferredPlacement: 'Topo centralizado ou rodapé centralizado',
      minClearance: '32px de respiro livre ao redor do monograma',
      colorVariantRules: 'Monocromático dourado sobre fundo preto',
    },
    do: ['Preservar contraste estrito preto e dourado', 'Garantir legibilidade máxima dos títulos'],
    dont: ['Nunca usar fundos claros saturados', 'Não distorcer o logotipo da marca'],
    manualGuidelinesSummary: 'Prioridade absoluta para o fundo preto e dourado nobre conforme diretrizes.',
    hasManualOverride: true,
  };

  const validated = BrandDNASchema.parse(sampleDNA);

  const res = await BrandDNAService.saveConsolidatedDNA(testClientId, orgId, validated, {
    sourcePieceIds: [testPieceId],
    model: 'gpt-4o',
    promptVersion: '2.0.0',
  });

  console.log('Brand DNA salvo com versão:', res.version);

  const { data: dnaRow } = await sb
    .from('brand_dna_versions')
    .select('id, version, status, source_piece_ids, model, prompt_version')
    .eq('client_id', testClientId)
    .single();

  console.log('brand_dna_versions gravado:', dnaRow);

  const { data: clientRow } = await sb
    .from('clients')
    .select('id, visual_memory_status, brand_status, dna')
    .eq('id', testClientId)
    .single();

  console.log('clients snapshot gravado:', {
    id: clientRow?.id,
    visual_memory_status: clientRow?.visual_memory_status,
    brand_status: clientRow?.brand_status,
    dna_summary: (clientRow?.dna as any)?.summary,
  });
}

main().catch(console.error);
