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
