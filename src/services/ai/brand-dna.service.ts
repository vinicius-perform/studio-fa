// src/services/ai/brand-dna.service.ts
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/config/env';
import { Logger } from '@/lib/logger';
import { IntegrationService } from '@/services/integrations/integration.service';
import { BrandDNA, BrandDNASchema } from '@/types/domain/dna';
import { PieceAnalysis } from '@/types/domain/piece';

export interface ConsolidateDNAInput {
  organizationId: string;
  clientId: string;
  clientName: string;
  clientNiche?: string | null;
  manualGuidelines?: string | null;
  brandIdentity?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    primaryFont?: string;
    secondaryFont?: string;
  };
  piecesAnalyses: Array<{
    pieceId: string;
    pieceType: string;
    formatType: string;
    analysis: PieceAnalysis;
  }>;
}

export class BrandDNAService {
  /**
   * Consolida o Brand DNA da marca utilizando OpenAI e garantindo prioridade absoluta
   * para as Diretrizes Manuais e Identidade Visual informadas pelo usuário.
   */
  public static async consolidateDNA(input: ConsolidateDNAInput): Promise<BrandDNA> {
    const supabase = getServiceRoleClient();
    const integrationService = new IntegrationService(supabase);

    // 1. Resolve chave da OpenAI
    const apiKey = await integrationService.resolveOpenAIKey(input.organizationId);
    if (!apiKey) {
      throw new Error('Chave de API da OpenAI não encontrada para consolidar o DNA Visual.');
    }

    // 2. Resolve o modelo operacional (integration_settings -> env -> fallback)
    const model = await integrationService.resolveOpenAIModel(input.organizationId, 'text');

    const { clientName, clientNiche, manualGuidelines, brandIdentity, piecesAnalyses } = input;
    const piecesCount = piecesAnalyses.length;

    // Se não há peças analisadas nem diretrizes manuais e nem identidade, retorna DNA vazio/mínimo
    if (piecesCount === 0 && !manualGuidelines && !brandIdentity?.primaryColor) {
      throw new Error('Não há peças de referência analisadas nem diretrizes manuais para gerar o DNA Visual.');
    }

    const systemPrompt = `Você é o Diretor Criativo Executivo do STUDIO FA.
Sua responsabilidade é consolidar o DNA VISUAL OFICIAL (Brand Visual DNA) da marca "${clientName}".

REGRA ABSOLUTA DE PRECEDÊNCIA:
1. DIRETRIZES MANUAIS FORNECIDAS PELO USUÁRIO SÃO SOBERANAS E TÊM PRIORIDADE MÁXIMA SOBRE TUDO.
   Se houver qualquer conflito entre o que foi observado nas peças e o que foi escrito nas diretrizes manuais, A DIRETRIZ MANUAL VENCE E DEVE PREVALECER INTEGRALMENTE.
2. A IDENTIDADE INSTITUCIONAL DECLARADA (Cores e Fontes manuais) tem precedência sobre cores acidentais de peças.
3. As peças de referência servem para enriquecer os detalhes de diagramação, respiro, hierarquia, pesos visuais e tratamentos complementares.

REGRA DE PONDERAÇÃO E HIERARQUIA DE PEÇAS:
- 'own_brand' (Peça da própria marca): PESO MÁXIMO E DOMINANTE (100%). Dita a identidade real, convenções institucionais, logos, cores e tipografia.
- 'promotional' (Peça promocional): PESO INTERMEDIÁRIO (70%). Ilustra como a marca desdobra campanhas, ofertas e CTAs.
- 'external_reference' (Referência externa de mercado): PESO SECUNDÁRIO/CONSULTIVO (30%). Serve estritamente como repertório de diagramação ou inspiração. NUNCA substitui cores, fontes ou convenções de marca própria nem sobrepõe diretrizes manuais.

DADOS DA MARCA:
- Nome: "${clientName}"
- Nicho/Segmento: "${clientNiche || 'Geral'}"
- Cores Declaradas Manualmente: Primária="${brandIdentity?.primaryColor || 'Não informada'}", Secundária="${brandIdentity?.secondaryColor || 'Não informada'}", Acento="${brandIdentity?.accentColor || 'Não informada'}"
- Fontes Declaradas: Título="${brandIdentity?.primaryFont || 'Não informada'}", Apoio="${brandIdentity?.secondaryFont || 'Não informada'}"
- Diretrizes Manuais Específicas do Usuário:
"""
${manualGuidelines || 'Nenhuma diretriz manual específica informada.'}
"""

ANÁLISES INDIVIDUAIS DAS ${piecesCount} PEÇAS ENVIADAS (com seus respectivos tipos e pesos):
${JSON.stringify(piecesAnalyses.map(p => ({
  tipo: p.pieceType,
  peso_consideracao: p.pieceType === 'own_brand' ? 'DOMINANTE_100%' : p.pieceType === 'promotional' ? 'INTERMEDIARIO_70%' : 'CONSULTIVO_30%',
  formato: p.formatType,
  resumo: p.analysis.summary,
  composicao: p.analysis.composition,
  hierarquia: p.analysis.hierarchy,
  tipografia: p.analysis.typography,
  cores: p.analysis.colors,
  imagem: p.analysis.imagery,
  elementos: p.analysis.graphicElements,
  logo: p.analysis.logo,
})), null, 2)}

RESPONDA OBRIGATORIAMENTE EM FORMATO JSON ESTRITO, SEGUINDO ESTE SCHEMA:
{
  "version": 1,
  "lastConsolidatedAt": "${new Date().toISOString()}",
  "analyzedPiecesCount": ${piecesCount},
  "summary": "Síntese executiva da identidade visual da marca (2 a 4 frases)",
  "toneAndVoice": "Tom visual dominante (ex: Premium, minimalista, corporativo sóbrio)",
  "colorSystem": {
    "primary": "#HEX (cor primária obrigatória)",
    "secondary": "#HEX (cor secundária de suporte)",
    "accent": "#HEX (cor de destaque ou CTA)",
    "neutrals": ["#HEX1", "#HEX2"] (fundos e textos neutros),
    "distributionRules": "Regra de proporção, ex: 60% fundo/neutros, 30% primária/secundária, 10% acento",
    "allowedCombinations": ["Combinações que funcionam com alto contraste"],
    "forbiddenCombinations": ["Combinações que nunca devem ser usadas"]
  },
  "typography": {
    "titleFont": "Nome ou família da fonte de títulos",
    "bodyFont": "Nome ou família da fonte de apoio/corpo",
    "hierarchyGuidelines": "Regras de escala, pesos recomendados e espaçamento",
    "caseRules": "Diretrizes de maiúsculas/minúsculas"
  },
  "composition": {
    "dominantLayout": "Estrutura geométrica preferida",
    "whiteSpaceRule": "Regra de área de segurança e respiro visual",
    "visualDensity": "low" | "medium" | "high",
    "focalPointGuideline": "Como guiar o olhar do espectador"
  },
  "imagery": {
    "photoStyle": "Diretriz para estilo fotográfico",
    "subjectTreatment": "Tratamento de pessoas/produtos",
    "lightingPreference": "Iluminação preferida",
    "mockupOrIllustrationUsage": "Quando e como usar ilustrações ou renders"
  },
  "graphicElements": {
    "allowedElements": ["Elementos autorizados"],
    "bannedElements": ["Elementos que descaracterizam a marca"],
    "textureGuidelines": "Uso de ruído, gradientes ou texturas"
  },
  "logoRules": {
    "preferredPlacement": "Onde posicionar o logo preferencialmente",
    "minClearance": "Margem mínima ao redor do logo",
    "colorVariantRules": "Quando usar versão monocromática vs colorida"
  },
  "do": ["Lista com pelo menos 4 a 6 itens OBRIGATÓRIOS ou boas práticas"],
  "dont": ["Lista com pelo menos 4 a 6 itens PROIBIDOS para manter a consistência da marca"],
  "manualGuidelinesSummary": "${manualGuidelines ? 'Resumo claro das diretrizes manuais respeitadas' : null}",
  "hasManualOverride": ${Boolean(manualGuidelines && manualGuidelines.trim().length > 0)}
}`;

    Logger.info({
      operation: 'brand_dna_consolidation',
      result: 'started',
      metadata: { clientId: input.clientId, piecesCount, model },
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Você é um arquiteto de identidades visuais que gera Brand DNAs técnicos estritamente em JSON.',
          },
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Falha ao consolidar DNA com OpenAI (status ${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI retornou conteúdo vazio para a consolidação do Brand DNA.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e: any) {
      throw new Error(`Erro ao interpretar JSON do Brand DNA: ${e.message}`);
    }

    // Validação com Zod
    const validated = BrandDNASchema.safeParse(parsed);
    if (!validated.success) {
      Logger.error(
        { operation: 'brand_dna_consolidation', result: 'error' },
        validated.error
      );
      // Tentativa de saneamento caso cores faltem #
      if (parsed?.colorSystem) {
        if (parsed.colorSystem.primary && !parsed.colorSystem.primary.startsWith('#')) {
          parsed.colorSystem.primary = `#${parsed.colorSystem.primary}`;
        }
        if (parsed.colorSystem.secondary && !parsed.colorSystem.secondary.startsWith('#')) {
          parsed.colorSystem.secondary = `#${parsed.colorSystem.secondary}`;
        }
        if (parsed.colorSystem.accent && !parsed.colorSystem.accent.startsWith('#')) {
          parsed.colorSystem.accent = `#${parsed.colorSystem.accent}`;
        }
      }
      const retry = BrandDNASchema.safeParse(parsed);
      if (!retry.success) {
        throw new Error(`Brand DNA fora do formato válido: ${retry.error.message}`);
      }
      return retry.data;
    }

    return validated.data;
  }

  /**
   * Salva o DNA consolidado no banco de dados do cliente e atualiza o status de memória visual.
   * Persiste na tabela versionada brand_dna_versions, no snapshot clients.dna e em brand_profiles.
   */
  public static async saveConsolidatedDNA(
    clientId: string,
    organizationId: string,
    dna: BrandDNA,
    options?: {
      sourcePieceIds?: string[];
      model?: string;
      promptVersion?: string;
      createdBy?: string;
    }
  ): Promise<{ version: number }> {
    const supabase = getServiceRoleClient();
    let nextVersion = 1;

    // 1. Persistência na tabela brand_dna_versions (histórico e rastreabilidade)
    try {
      const { data: latestVersion } = await (supabase as any)
        .from('brand_dna_versions')
        .select('version')
        .eq('client_id', clientId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      nextVersion = latestVersion ? (latestVersion.version || 1) + 1 : 1;

      await (supabase as any).from('brand_dna_versions').insert({
        organization_id: organizationId,
        client_id: clientId,
        version: nextVersion,
        status: 'ready',
        profile_json: dna,
        source_piece_ids: options?.sourcePieceIds || [],
        model: options?.model || 'gpt-4o',
        prompt_version: options?.promptVersion || '2.0.0',
        created_by: options?.createdBy || null,
        created_at: new Date().toISOString(),
      });
    } catch (verErr: any) {
      console.warn('[BrandDNAService] Aviso ao persistir em brand_dna_versions:', verErr?.message);
    }

    // 2. Atualiza snapshot na tabela clients
    try {
      const { error: clientErr } = await supabase
        .from('clients')
        .update({
          dna: dna as any,
          visual_memory_status: 'ready',
          brand_status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .eq('organization_id', organizationId);

      if (clientErr) {
        console.warn('[BrandDNAService] Aviso ao atualizar clients:', clientErr.message);
      }
    } catch (clientErr: any) {
      console.warn('[BrandDNAService] Aviso ao atualizar clients:', clientErr?.message);
    }

    // 3. Atualiza ou insere na tabela brand_profiles para total retrocompatibilidade
    try {
      await (supabase as any).from('brand_profiles').insert({
        organization_id: organizationId,
        client_id: clientId,
        version: nextVersion,
        status: 'approved',
        source: dna.hasManualOverride ? 'hybrid' : 'ai',
        confidence_score: 0.95,
        summary: dna.summary,
        colors: {
          primary: [dna.colorSystem.primary],
          secondary: [dna.colorSystem.secondary],
          accent: [dna.colorSystem.accent],
          neutrals: dna.colorSystem.neutrals,
          rules: dna.colorSystem.distributionRules,
        },
        typography: {
          title: dna.typography.titleFont,
          body: dna.typography.bodyFont,
          rules: dna.typography.hierarchyGuidelines,
        },
        photography: {
          photoStyle: dna.imagery.photoStyle,
          treatment: dna.imagery.subjectTreatment,
          lighting: dna.imagery.lightingPreference,
        },
        composition: {
          layout: dna.composition.dominantLayout,
          whiteSpace: dna.composition.whiteSpaceRule,
          density: dna.composition.visualDensity,
        },
        dos: dna.do,
        donts: dna.dont,
        approved_at: new Date().toISOString(),
      });
    } catch (profileErr: any) {
      console.warn('[BrandDNAService] Aviso ao salvar em brand_profiles:', profileErr?.message);
    }

    return { version: nextVersion };
  }
}
