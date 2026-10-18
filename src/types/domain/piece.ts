// src/types/domain/piece.ts
import { z } from 'zod';

export const FormatTypeSchema = z.enum(['feed', 'story', 'square', 'cover', 'custom']);
export type FormatType = z.infer<typeof FormatTypeSchema>;

export const PieceTypeSchema = z.enum(['own_brand', 'external_reference', 'promotional']);
export type PieceType = z.infer<typeof PieceTypeSchema>;

export const AnalysisStatusSchema = z.enum(['pending', 'queued', 'analyzing', 'completed', 'failed']);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const PieceAnalysisSchema = z.object({
  summary: z.string().describe('Resumo geral da composição e impacto visual da peça'),
  composition: z.object({
    layoutStyle: z.string().describe('Estilo de layout: ex. minimalista, editorial, comercial denso, centrado'),
    alignment: z.string().describe('Alinhamento principal dos elementos: esquerda, centro, direita, assimétrico'),
    balance: z.string().describe('Equilíbrio visual: simétrico, assimétrico balanceado, radial'),
    whiteSpace: z.string().describe('Uso do espaço negativo/respiro: amplo, moderado, apertado'),
    density: z.enum(['low', 'medium', 'high']).describe('Densidade de elementos e texto na peça'),
  }),
  hierarchy: z.object({
    primaryFocus: z.string().describe('Ponto focal inicial (geralmente título de impacto ou produto)'),
    secondaryElements: z.string().describe('Elementos secundários (subtítulo, badges, detalhes)'),
    actionOrFooter: z.string().describe('Elemento final ou chamada (CTA, @perfil, rodapé)'),
  }),
  typography: z.object({
    primaryStyle: z.string().describe('Estilo tipográfico dominante: sem serifa geométrica, com serifa editorial, display bold, etc.'),
    titleWeight: z.string().describe('Peso dos títulos: ex. Bold 700, Black 900'),
    bodyStyle: z.string().describe('Estilo do corpo do texto e legibilidade'),
    contrast: z.string().describe('Avaliação do contraste texto/fundo: alto, médio, baixo'),
    observedFamilies: z.array(z.string()).default([]).describe('Possíveis fontes ou famílias detectadas'),
  }),
  colors: z.object({
    primary: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Cor primária deve ser código HEX').describe('Cor primária dominante em HEX'),
    secondary: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Cor secundária deve ser código HEX').describe('Cor secundária em HEX'),
    accent: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Cor de acento deve ser código HEX').describe('Cor de destaque/acento em HEX'),
    background: z.string().describe('Cor ou tipo do fundo: HEX ou descrição (ex: gradiente escuro, foto desfocada)'),
    palette: z.array(z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/)).describe('Paleta completa identificada na peça (3 a 6 cores HEX)'),
  }),
  imagery: z.object({
    hasImage: z.boolean().describe('Indica se há fotografia ou ilustração na peça'),
    imageType: z.string().describe('Tipo de imagem: foto de pessoa, produto real, mockup 3D, ilustração, vetor, abstrato'),
    treatment: z.string().describe('Tratamento da imagem: recorte limpo, integração suave, máscara, filtro de cor'),
    lighting: z.string().describe('Iluminação: natural, estúdio suave, alto contraste dramático, neon'),
  }),
  graphicElements: z.object({
    shapes: z.array(z.string()).default([]).describe('Formas geométricas ou orgânicas observadas'),
    textures: z.string().describe('Presença de granulação, ruído, grid de linhas ou texturas'),
    framing: z.string().describe('Bordas, molduras ou divisões de layout'),
  }),
  logo: z.object({
    present: z.boolean().describe('Se o logo da marca está presente na peça'),
    placement: z.string().describe('Posicionamento do logo: topo-centro, topo-esquerda, rodapé-direita, etc.'),
    variant: z.string().describe('Versão do logo utilizada: colorida, monocromática branca, monocromática preta, ícone isolado'),
    readability: z.string().describe('Legibilidade e área de respiro do logo na composição'),
  }),
  strengths: z.array(z.string()).default([]).describe('Pontos fortes visuais da peça'),
  weaknesses: z.array(z.string()).default([]).describe('Pontos de melhoria ou inconsistências'),
  qualityScore: z.number().min(0).max(10).describe('Score geral de qualidade do design de 0 a 10'),
  confidence: z.number().min(0).max(1).describe('Grau de confiança da IA na análise (0.0 a 1.0)'),
});

export type PieceAnalysis = z.infer<typeof PieceAnalysisSchema>;

export interface ClientPieceItem {
  id: string;
  organization_id?: string;
  organizationId?: string;
  client_id?: string;
  clientId?: string;
  title: string | null;
  original_filename: string;
  originalFilename?: string;
  storage_bucket?: string;
  storageBucket?: string;
  storage_path?: string;
  storagePath?: string;
  file_size_bytes?: number;
  fileSizeBytes?: number;
  mime_type?: string;
  mimeType?: string;
  width: number | null;
  height: number | null;
  aspect_ratio?: number | null;
  aspectRatio?: number | null;
  format_type: FormatType;
  formatType?: FormatType;
  piece_type: PieceType;
  pieceType?: PieceType;
  analysis_status: AnalysisStatus;
  analysisStatus?: AnalysisStatus;
  analysis_json: PieceAnalysis | null;
  analysisJson?: PieceAnalysis | null;
  analysis_model?: string | null;
  analysisModel?: string | null;
  analysis_prompt_version?: string | null;
  analysisPromptVersion?: string | null;
  analysis_error?: string | null;
  analysisError?: string | null;
  analyzed_at?: string | null;
  analyzedAt?: string | null;
  quality_score?: number | null;
  qualityScore?: number | null;
  created_by?: string | null;
  createdBy?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  signedUrl?: string;
}
