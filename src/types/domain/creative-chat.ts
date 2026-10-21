// src/types/domain/creative-chat.ts
import { z } from 'zod';
import type { FormatId } from '@/config/formats';

/**
 * Cor identificada no DNA visual
 */
export const DetectedColorSwatchSchema = z.object({
  name: z.string(),
  hex: z.string(),
  role: z.string(), // ex: 'Fundo primário', 'Verde Neon de Acento', 'Branco Tipográfico'
  isAccent: z.boolean().default(false),
});

export type DetectedColorSwatch = z.infer<typeof DetectedColorSwatchSchema>;

/**
 * Tabela de elementos de design visual
 */
export const DesignElementsTableSchema = z.object({
  aesthetic: z.string(), // ex: 'Futurista, tecnológica, comercial forte'
  background: z.string(), // ex: 'Preto profundo, gradientes verde-escuros sutis'
  typography: z.string(), // ex: 'Sans-serif geométrica, títulos bold/extrabold e textos finos'
  hierarchy: z.string(), // ex: 'Headlines dominantes, palavras-chave destacadas em verde neon'
  composition: z.string(), // ex: 'Assimétrica, com bastante espaço negativo reservado'
  photography: z.string(), // ex: 'Visuals tecnológicos, objetos 3D, iluminação cinematográfica'
  graphicElements: z.string(), // ex: 'Linhas finas, símbolos de marca, contornos e glows sutis'
  communication: z.string().default('Provocativa, direta e voltada a resultados e conversão'),
});

export type DesignElementsTable = z.infer<typeof DesignElementsTableSchema>;

/**
 * Estilo predominante identificado na marca
 */
export const PredominantStyleSchema = z.object({
  id: z.string(),
  letter: z.string(), // 'A', 'B', 'C'
  title: z.string(), // ex: 'Tech cinematográfica'
  name: z.string().optional(),
  description: z.string(), // ex: 'Objetos tridimensionais, luz verde, sombras profundas e sensação de movimento...'
  tag: z.string(), // ex: 'Campanhas de impacto'
  useCase: z.string().optional(),
  samplePieceId: z.string().optional(),
  sampleImageUrl: z.string().optional(),
});

export type PredominantStyle = z.infer<typeof PredominantStyleSchema>;

/**
 * Relatório completo de Análise Visual Conversacional
 */
export const VisualAnalysisReportSchema = z.object({
  clientName: z.string(),
  analyzedPiecesCount: z.number().default(0),
  concept: z.string().default('Tech Performance + Minimalismo Editorial + Design de Alto Contraste'),
  conceptSummary: z.string().optional(),
  executiveSummary: z.string().default(''),
  colorPalette: z.array(DetectedColorSwatchSchema).default([]),
  colorSwatches: z.array(DetectedColorSwatchSchema).optional(),
  elements: DesignElementsTableSchema,
  predominantStyles: z.array(PredominantStyleSchema).default([]),
  recognizableFeatures: z.array(z.string()).default([]),
  guidelines: z.object({
    keep: z.array(z.string()).default([]),
    avoid: z.array(z.string()).default([]),
  }),
  artDirectionReview: z.object({
    consistencyScore: z.number().min(0).max(100).default(90),
    scoreLabel: z.string().default('9/10 - Identidade Visual Consistente'),
    critique: z.string().default(''),
    conclusion: z.string(),
  }),
  analyzedAt: z.string().default(() => new Date().toISOString()),
});

export type VisualAnalysisReport = z.infer<typeof VisualAnalysisReportSchema>;

/**
 * Anexo de mensagem do Chat
 */
export const ChatAttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['reference_piece', 'layout_print', 'client_logo', 'external_upload', 'image', 'print']),
  title: z.string().optional(),
  name: z.string().optional(),
  url: z.string(),
  storagePath: z.string().optional(),
  pieceId: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isLayoutPrint: z.boolean().optional(),
  isSubjectPhoto: z.boolean().optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
});

export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

/**
 * Peça gerada no Chat
 */
export const GeneratedChatPieceSchema = z.object({
  projectId: z.string(),
  slideId: z.string(),
  title: z.string(),
  format: z.string().default('instagram_feed_4_5'),
  aspectRatio: z.string().default('4:5'),
  projectType: z.enum(['single_post', 'carousel']).default('single_post'),
  previewUrl: z.string(),
  backgroundUrl: z.string(),
  headline: z.string().optional(),
  subtitle: z.string().optional(),
  cta: z.string().optional(),
  modelUsed: z.string().default('gpt-image-2.5-flare'),
  activeReferencesCount: z.number().optional(),
  layersCount: z.number().default(1),
  createdAt: z.string(),
  carouselSlides: z.array(
    z.object({
      slideId: z.string(),
      slideIndex: z.number(),
      title: z.string(),
      previewUrl: z.string(),
    })
  ).optional(),
});

export type GeneratedChatPiece = z.infer<typeof GeneratedChatPieceSchema>;

/**
 * Erro explícito de geração da IA
 */
export const GenerationErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  technicalDetails: z.string().optional(),
  failedPrompt: z.string().optional(),
  selectedReferenceId: z.string().optional(),
});

export type GenerationError = z.infer<typeof GenerationErrorSchema>;

/**
 * Mensagem do Chat Criativo
 */
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
  attachments: z.array(ChatAttachmentSchema).optional(),
  analysisReport: VisualAnalysisReportSchema.optional(),
  visualAnalysis: VisualAnalysisReportSchema.optional(),
  generatedPiece: GeneratedChatPieceSchema.optional(),
  generationError: GenerationErrorSchema.optional(),
  isPending: z.boolean().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Interpretação de prompt criativo em linguagem natural
 */
export const InterpretedCreativeIntentSchema = z.object({
  format: z.custom<FormatId>().default('instagram_feed_4_5'),
  aspectRatio: z.string().default('4:5'),
  projectType: z.enum(['single_post', 'carousel']).default('single_post'),
  headline: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  cta: z.string().optional(),
  visualDirection: z.string().optional(),
  visualStyle: z.string().optional(),
  negativeSpacePreference: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional(),
  useLayoutPrintAsStructure: z.boolean().optional(),
  rawPrompt: z.string().optional(),
});

export type InterpretedCreativeIntent = z.infer<typeof InterpretedCreativeIntentSchema>;
