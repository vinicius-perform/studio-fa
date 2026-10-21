// src/types/domain/dna.ts
import { z } from 'zod';

export const BrandDNASchema = z.object({
  version: z.number().default(1).describe('Versão do DNA Visual consolidado'),
  lastConsolidatedAt: z.string().describe('Data ISO da última consolidação'),
  analyzedPiecesCount: z.number().default(0).describe('Quantidade de peças analisadas na consolidação'),
  summary: z.string().describe('Síntese executiva da identidade e estilo visual da marca'),
  toneAndVoice: z.string().describe('Tom visual da marca: sofisticado, disruptivo, corporativo, acessível, etc.'),
  
  colorSystem: z.object({
    primary: z.string().describe('Cor primária institucional (HEX)'),
    secondary: z.string().describe('Cor secundária institucional (HEX)'),
    accent: z.string().describe('Cor de acento/CTA (HEX)'),
    neutrals: z.array(z.string()).default([]).describe('Cores neutras de fundo e textos secundários (HEX)'),
    distributionRules: z.string().describe('Regras de proporção (ex: 60% neutros/fundo, 30% primária/secundária, 10% acento)'),
    allowedCombinations: z.array(z.string()).default([]).describe('Combinações de cores permitidas'),
    forbiddenCombinations: z.array(z.string()).default([]).describe('Combinações de cores estritamente proibidas'),
  }),

  typography: z.object({
    titleFont: z.string().describe('Tipografia de título recomendada/extraída'),
    bodyFont: z.string().describe('Tipografia de corpo de texto'),
    hierarchyGuidelines: z.string().describe('Regras de contraste de peso, kerning e espaçamento de linha'),
    caseRules: z.string().describe('Uso de caixa alta (UPPERCASE) vs mista (Sentence case) em títulos e subtítulos'),
  }),

  composition: z.object({
    dominantLayout: z.string().describe('Estrutura de layout predominante (assimétrico, centrado, grid editorial)'),
    whiteSpaceRule: z.string().describe('Regra de respiro e margens de segurança'),
    visualDensity: z.enum(['low', 'medium', 'high']).describe('Nível de densidade visual recomendado'),
    focalPointGuideline: z.string().describe('Como construir a hierarquia e o gancho visual'),
  }),

  imagery: z.object({
    photoStyle: z.string().describe('Estilo fotográfico preferido da marca'),
    subjectTreatment: z.string().describe('Tratamento de pessoas, produtos ou recortes'),
    lightingPreference: z.string().describe('Tipo de iluminação dominante'),
    mockupOrIllustrationUsage: z.string().describe('Diretriz para uso de elementos 3D ou ilustrações'),
  }),

  graphicElements: z.object({
    allowedElements: z.array(z.string()).default([]).describe('Elementos gráficos autorizados (ex: molduras finas, sombras difusas)'),
    bannedElements: z.array(z.string()).default([]).describe('Elementos gráficos proibidos (ex: gradientes arco-íris, 3d flutuante genérico)'),
    textureGuidelines: z.string().describe('Diretrizes sobre uso de granulação, ruído ou texturas'),
  }),

  logoRules: z.object({
    preferredPlacement: z.string().describe('Posicionamento preferencial do logo'),
    minClearance: z.string().describe('Área mínima de respiro do logo'),
    colorVariantRules: z.string().describe('Quando usar versão positiva, negativa ou ícone'),
  }),

  do: z.array(z.string()).describe('Lista explícita de boas práticas e obrigatoriedades visuais'),
  dont: z.array(z.string()).describe('Lista explícita de proibições e erros que a IA deve evitar'),

  manualGuidelinesSummary: z.string().nullable().default(null).describe('Síntese das diretrizes manuais inseridas pelo usuário'),
  hasManualOverride: z.boolean().default(false).describe('Indica se há regras manuais soberanas sobre a IA'),
});

export type BrandDNA = z.infer<typeof BrandDNASchema>;

export interface DisplayColorSystem {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  neutrals: string[];
  distributionRules: string | null;
  allowedCombinations: string[];
  forbiddenCombinations: string[];
}

export interface DisplayTypography {
  titleFont: string | null;
  bodyFont: string | null;
  hierarchyGuidelines: string | null;
  caseRules: string | null;
}

export interface DisplayComposition {
  dominantLayout: string | null;
  whiteSpaceRule: string | null;
  visualDensity: 'low' | 'medium' | 'high' | null;
  focalPointGuideline: string | null;
}

export interface DisplayImagery {
  photoStyle: string | null;
  subjectTreatment: string | null;
  lightingPreference: string | null;
  mockupOrIllustrationUsage: string | null;
}

export interface DisplayGraphicElements {
  allowedElements: string[];
  bannedElements: string[];
  textureGuidelines: string | null;
}

export interface DisplayLogoRules {
  preferredPlacement: string | null;
  minClearance: string | null;
  colorVariantRules: string | null;
}

export interface DisplayBrandDNA {
  version: number;
  lastConsolidatedAt: string | null;
  analyzedPiecesCount: number;
  summary: string;
  toneAndVoice: string | null;
  colorSystem: DisplayColorSystem | null;
  typography: DisplayTypography | null;
  composition: DisplayComposition | null;
  imagery: DisplayImagery | null;
  graphicElements: DisplayGraphicElements | null;
  logoRules: DisplayLogoRules | null;
  do: string[];
  dont: string[];
  manualGuidelinesSummary: string | null;
  hasManualOverride: boolean;
}

export function normalizeBrandDNAForDisplay(raw?: any): DisplayBrandDNA | null {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
    return null;
  }

  // Se não houver campos que indiquem um DNA minimamente existente
  if (!raw.summary && !raw.colorSystem && !raw.typography && !raw.composition && !raw.version) {
    return null;
  }

  const colorSystem: DisplayColorSystem | null =
    raw.colorSystem && typeof raw.colorSystem === 'object'
      ? {
          primary:
            typeof raw.colorSystem.primary === 'string' && raw.colorSystem.primary.trim()
              ? raw.colorSystem.primary.trim()
              : null,
          secondary:
            typeof raw.colorSystem.secondary === 'string' && raw.colorSystem.secondary.trim()
              ? raw.colorSystem.secondary.trim()
              : null,
          accent:
            typeof raw.colorSystem.accent === 'string' && raw.colorSystem.accent.trim()
              ? raw.colorSystem.accent.trim()
              : null,
          neutrals: Array.isArray(raw.colorSystem.neutrals)
            ? raw.colorSystem.neutrals.filter((n: any) => typeof n === 'string')
            : [],
          distributionRules:
            typeof raw.colorSystem.distributionRules === 'string' && raw.colorSystem.distributionRules.trim()
              ? raw.colorSystem.distributionRules.trim()
              : null,
          allowedCombinations: Array.isArray(raw.colorSystem.allowedCombinations)
            ? raw.colorSystem.allowedCombinations.filter((c: any) => typeof c === 'string')
            : [],
          forbiddenCombinations: Array.isArray(raw.colorSystem.forbiddenCombinations)
            ? raw.colorSystem.forbiddenCombinations.filter((c: any) => typeof c === 'string')
            : [],
        }
      : null;

  const typography: DisplayTypography | null =
    raw.typography && typeof raw.typography === 'object'
      ? {
          titleFont:
            typeof raw.typography.titleFont === 'string' && raw.typography.titleFont.trim()
              ? raw.typography.titleFont.trim()
              : null,
          bodyFont:
            typeof raw.typography.bodyFont === 'string' && raw.typography.bodyFont.trim()
              ? raw.typography.bodyFont.trim()
              : null,
          hierarchyGuidelines:
            typeof raw.typography.hierarchyGuidelines === 'string' && raw.typography.hierarchyGuidelines.trim()
              ? raw.typography.hierarchyGuidelines.trim()
              : null,
          caseRules:
            typeof raw.typography.caseRules === 'string' && raw.typography.caseRules.trim()
              ? raw.typography.caseRules.trim()
              : null,
        }
      : null;

  const composition: DisplayComposition | null =
    raw.composition && typeof raw.composition === 'object'
      ? {
          dominantLayout:
            typeof raw.composition.dominantLayout === 'string' && raw.composition.dominantLayout.trim()
              ? raw.composition.dominantLayout.trim()
              : null,
          whiteSpaceRule:
            typeof raw.composition.whiteSpaceRule === 'string' && raw.composition.whiteSpaceRule.trim()
              ? raw.composition.whiteSpaceRule.trim()
              : null,
          visualDensity:
            ['low', 'medium', 'high'].includes(raw.composition.visualDensity)
              ? raw.composition.visualDensity
              : null,
          focalPointGuideline:
            typeof raw.composition.focalPointGuideline === 'string' && raw.composition.focalPointGuideline.trim()
              ? raw.composition.focalPointGuideline.trim()
              : null,
        }
      : null;

  const imagery: DisplayImagery | null =
    raw.imagery && typeof raw.imagery === 'object'
      ? {
          photoStyle:
            typeof raw.imagery.photoStyle === 'string' && raw.imagery.photoStyle.trim()
              ? raw.imagery.photoStyle.trim()
              : null,
          subjectTreatment:
            typeof raw.imagery.subjectTreatment === 'string' && raw.imagery.subjectTreatment.trim()
              ? raw.imagery.subjectTreatment.trim()
              : null,
          lightingPreference:
            typeof raw.imagery.lightingPreference === 'string' && raw.imagery.lightingPreference.trim()
              ? raw.imagery.lightingPreference.trim()
              : null,
          mockupOrIllustrationUsage:
            typeof raw.imagery.mockupOrIllustrationUsage === 'string' && raw.imagery.mockupOrIllustrationUsage.trim()
              ? raw.imagery.mockupOrIllustrationUsage.trim()
              : null,
        }
      : null;

  const graphicElements: DisplayGraphicElements | null =
    raw.graphicElements && typeof raw.graphicElements === 'object'
      ? {
          allowedElements: Array.isArray(raw.graphicElements.allowedElements)
            ? raw.graphicElements.allowedElements.filter((e: any) => typeof e === 'string')
            : [],
          bannedElements: Array.isArray(raw.graphicElements.bannedElements)
            ? raw.graphicElements.bannedElements.filter((e: any) => typeof e === 'string')
            : [],
          textureGuidelines:
            typeof raw.graphicElements.textureGuidelines === 'string' && raw.graphicElements.textureGuidelines.trim()
              ? raw.graphicElements.textureGuidelines.trim()
              : null,
        }
      : null;

  const logoRules: DisplayLogoRules | null =
    raw.logoRules && typeof raw.logoRules === 'object'
      ? {
          preferredPlacement:
            typeof raw.logoRules.preferredPlacement === 'string' && raw.logoRules.preferredPlacement.trim()
              ? raw.logoRules.preferredPlacement.trim()
              : null,
          minClearance:
            typeof raw.logoRules.minClearance === 'string' && raw.logoRules.minClearance.trim()
              ? raw.logoRules.minClearance.trim()
              : null,
          colorVariantRules:
            typeof raw.logoRules.colorVariantRules === 'string' && raw.logoRules.colorVariantRules.trim()
              ? raw.logoRules.colorVariantRules.trim()
              : null,
        }
      : null;

  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    lastConsolidatedAt:
      typeof raw.lastConsolidatedAt === 'string' && raw.lastConsolidatedAt.trim()
        ? raw.lastConsolidatedAt.trim()
        : null,
    analyzedPiecesCount:
      typeof raw.analyzedPiecesCount === 'number' ? raw.analyzedPiecesCount : 0,
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : 'Identidade visual da marca.',
    toneAndVoice:
      typeof raw.toneAndVoice === 'string' && raw.toneAndVoice.trim()
        ? raw.toneAndVoice.trim()
        : null,
    colorSystem,
    typography,
    composition,
    imagery,
    graphicElements,
    logoRules,
    do: Array.isArray(raw.do) ? raw.do.filter((d: any) => typeof d === 'string') : [],
    dont: Array.isArray(raw.dont) ? raw.dont.filter((d: any) => typeof d === 'string') : [],
    manualGuidelinesSummary:
      typeof raw.manualGuidelinesSummary === 'string' && raw.manualGuidelinesSummary.trim()
        ? raw.manualGuidelinesSummary.trim()
        : null,
    hasManualOverride: Boolean(raw.hasManualOverride),
  };
}
