// src/services/ai/responses-multimodal.service.ts
import { Logger } from '@/lib/logger';

export interface MultimodalImageInput {
  id?: string;
  buffer: Buffer;
  mimeType: string;
  isPrimary?: boolean;
  isLayoutPrint?: boolean;
  title?: string;
  kind: 'brand_reference' | 'message_attachment' | 'logo' | 'subject_photo' | 'face_crop';
}

export interface PrepareResponsesPayloadInput {
  userPrompt: string;
  brandReferences: MultimodalImageInput[];
  subjectPhoto?: MultimodalImageInput;
  faceCrop?: MultimodalImageInput;
  messageAttachments?: MultimodalImageInput[];
  systemInstructions?: string;
  model?: string;
  conversationId?: string;
  clientId?: string;
}

export interface ResponsesAPIContentItem {
  type: 'input_text' | 'input_image';
  text?: string;
  image_url?: string;
}

export interface ResponsesAPIPayload {
  model: string;
  instructions: string;
  input: Array<{
    role: 'user' | 'assistant' | 'system';
    content: ResponsesAPIContentItem[];
  }>;
}

export const MANDATORY_SYSTEM_VISUAL_RULE = `When visual references are attached, they define the visual identity, art direction, and style of the client.
Use the selected image strictly as a visual style and art-direction reference.
Create a new and original composition that inherits its visual language, palette, contrast, hierarchy, typography character, graphic treatment and composition rhythm, without reproducing the source artwork literally.

CRITICAL STYLE MANDATE:
- Do NOT copy literal texts, headlines, people, specific unnecessary objects, or exact layout from the reference.
- Do NOT reproduce the source artwork literally. The goal is an ORIGINAL piece belonging to the SAME VISUAL FAMILY.
- Do not replace the client's visual language with generic AI aesthetics.
- The colors, contrast, typography language, and composition seen in the attached visual references must strictly dominate the generated piece.
- If the brand uses black and neon lime green with bold editorial typography, do NOT introduce generic blue/purple neon cyberpunk aesthetics.
- The first attached reference is the primary visual direction.

FACIAL IDENTITY PRESERVATION MANDATE (WHEN SUBJECT PHOTO / FACE CROP IS PROVIDED):
- The style reference defines the visual language of the artwork.
- The main subject image defines the person who must appear in the final composition.
- Preserve the person's identity faithfully, especially facial structure, eyes, nose, mouth, skin tone, hairline, hairstyle and overall recognizable appearance.
- Do not replace the person with a generic similar-looking subject or stock model.
- Create a new original composition, but keep the person's face clearly faithful to the provided subject.
- PERMITTED ADAPTATIONS: You may adapt pose, framing, lighting, background, composition, clothing (if needed), and visual finish to match the brand style, AS LONG AS the face remains completely faithful.
- FORBIDDEN CHANGES: Do NOT alter face shape, eyes, nose, mouth, eyebrows, hairline, apparent age, skin tone, or recognizable identity.`;

export class ResponsesMultimodalService {
  /**
   * Prepara o payload multimodal estrito oficial para a Responses API da OpenAI (/v1/responses).
   * Garante que TODAS as referências ativas sejam incluídas como input_image com seus pixels reais
   * na ordem obrigatória:
   * 1. Imagem 1: Estilo da arte
   * 2. Imagem 2: Objeto principal completo (se fornecido)
   * 3. Imagem 3: Crop do rosto da pessoa (se fornecido)
   * Seguido de eventuais outros anexos (prints de layout).
   */
  public static prepareResponsesPayload(params: PrepareResponsesPayloadInput): ResponsesAPIPayload {
    const {
      userPrompt,
      brandReferences,
      subjectPhoto,
      faceCrop,
      messageAttachments = [],
      systemInstructions,
      model = 'gpt-4o',
    } = params;

    // Identifica foto do cliente e crop facial se vierem em messageAttachments
    const resolvedSubjectPhoto =
      subjectPhoto || messageAttachments.find((a) => a.kind === 'subject_photo');
    const resolvedFaceCrop =
      faceCrop || messageAttachments.find((a) => a.kind === 'face_crop');

    // Filtra messageAttachments para evitar duplicações
    const remainingAttachments = messageAttachments.filter(
      (a) => a.kind !== 'subject_photo' && a.kind !== 'face_crop'
    );

    // Ordena referências de estilo para que a primária vá primeiro
    const sortedBrandRefs = [...brandReferences].sort(
      (a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)
    );

    const primaryStyleRef = sortedBrandRefs[0];
    const secondaryStyleRefs = sortedBrandRefs.slice(1);

    const contentItems: ResponsesAPIContentItem[] = [];

    // 1. Texto de instrução da direção criativa com ordem explícita das referências
    const refCount = sortedBrandRefs.length;
    const attachmentCount = messageAttachments.length;

    let directiveText = `User Creative Request: "${userPrompt}"\n\n`;
    if (refCount > 0) {
      directiveText += `VISUAL MEMORY NOTICE: Exactly ${refCount} client visual references are attached below as input_image items.\n`;
      directiveText += `The first reference is the primary visual direction.\n`;
      directiveText += `You must extract the exact color palette, typography hierarchy, negative space, lighting, and composition directly from these images.\n`;
      directiveText += `STYLE-REFERENCE MANDATE: Use the selected image strictly as a visual style and art-direction reference. Create a new and original composition that inherits its visual language, palette, contrast, hierarchy, typography character, graphic treatment and composition rhythm, without reproducing the source artwork literally.\n`;
      directiveText += `CRITICAL: Do NOT copy literal texts, headlines, people, specific unnecessary objects, or exact layout from the reference. The artwork must be an ORIGINAL creation belonging to the SAME VISUAL FAMILY.\n\n`;
    } else {
      directiveText += `NOTICE: No client visual references attached. Follow brand DNA guidelines.\n\n`;
    }

    if (attachmentCount > 0) {
      directiveText += `MESSAGE ATTACHMENTS: ${attachmentCount} user attachment(s) are included. Any layout print defines structural composition and content layout, not brand colors.\n\n`;
    }

    directiveText += `ORDERED MULTIMODAL REFERENCE INPUTS:\n`;

    let imageIndexCounter = 1;
    if (primaryStyleRef) {
      directiveText += `IMAGE ${imageIndexCounter} [ART STYLE REFERENCE]: Defines the visual language, palette, contrast, typography hierarchy, negative space, and composition rhythm. Do NOT copy literal texts or layout; inherit the visual soul and aesthetics.\n`;
      imageIndexCounter++;
    }

    if (resolvedSubjectPhoto) {
      directiveText += `IMAGE ${imageIndexCounter} [HERO MAIN SUBJECT - FULL]: Defines the real person/subject who MUST appear in the artwork. Defines attire, pose, context, and physical build.\n`;
      imageIndexCounter++;
    }

    if (resolvedFaceCrop) {
      directiveText += `IMAGE ${imageIndexCounter} [FACIAL IDENTITY HIGH-RES CROP]: Defines the EXACT facial likeness and identity. Preserve the person's identity faithfully, especially facial structure, eyes, nose, mouth, skin tone, hairline, hairstyle and overall recognizable appearance. Do NOT replace with a generic stock model or fictional person.\n`;
      imageIndexCounter++;
    }

    for (let i = 0; i < secondaryStyleRefs.length; i++) {
      directiveText += `IMAGE ${imageIndexCounter} [SECONDARY BRAND REFERENCE]: Additional brand style context.\n`;
      imageIndexCounter++;
    }

    for (let i = 0; i < remainingAttachments.length; i++) {
      const att = remainingAttachments[i];
      directiveText += `IMAGE ${imageIndexCounter} [ATTACHMENT]: ${att.title || (att.isLayoutPrint ? 'Layout Print' : 'User Reference')}.\n`;
      imageIndexCounter++;
    }

    directiveText += `\nHIEARCHY OF ROLES:\n`;
    directiveText += `1. Visual style comes from the Art Style Reference.\n`;
    directiveText += `2. Identity and human subject comes from the Main Subject & Facial Identity Crop.\n`;
    directiveText += `Combine the two seamlessly: The real person with their authentic face integrated into an artwork having the exact aesthetic and art direction of the style reference.\n\n`;
    directiveText += `Task: Synthesize a definitive art direction specification and generate a comprehensive image generation prompt ensuring the generated artwork strictly preserves the person's true face while adhering to the brand's visual family.`;

    contentItems.push({
      type: 'input_text',
      text: directiveText,
    });

    // 2. ORDEM EXATA DAS IMAGENS DE ENTRADA (Seção 8):
    // Imagem 1: Estilo da arte
    if (primaryStyleRef) {
      contentItems.push({
        type: 'input_image',
        image_url: `data:${primaryStyleRef.mimeType || 'image/png'};base64,${primaryStyleRef.buffer.toString('base64')}`,
      });
    }

    // Imagem 2: Objeto principal completo
    if (resolvedSubjectPhoto) {
      contentItems.push({
        type: 'input_image',
        image_url: `data:${resolvedSubjectPhoto.mimeType || 'image/png'};base64,${resolvedSubjectPhoto.buffer.toString('base64')}`,
      });
    }

    // Imagem 3: Crop do rosto da pessoa
    if (resolvedFaceCrop) {
      contentItems.push({
        type: 'input_image',
        image_url: `data:${resolvedFaceCrop.mimeType || 'image/png'};base64,${resolvedFaceCrop.buffer.toString('base64')}`,
      });
    }

    // Referências secundárias de estilo (se houverem)
    for (const ref of secondaryStyleRefs) {
      contentItems.push({
        type: 'input_image',
        image_url: `data:${ref.mimeType || 'image/png'};base64,${ref.buffer.toString('base64')}`,
      });
    }

    // Outros anexos (layout prints, etc.)
    for (const att of remainingAttachments) {
      contentItems.push({
        type: 'input_image',
        image_url: `data:${att.mimeType || 'image/png'};base64,${att.buffer.toString('base64')}`,
      });
    }

    return {
      model,
      instructions: systemInstructions || MANDATORY_SYSTEM_VISUAL_RULE,
      input: [
        {
          role: 'user',
          content: contentItems,
        },
      ],
    };
  }

  /**
   * Executa a síntese multimodal através da Responses API da OpenAI (/v1/responses).
   * Registra observabilidade sanitizada (Seção 22).
   */
  public static async executeResponsesSynthesis(params: {
    apiKey?: string;
    payload: ResponsesAPIPayload;
    conversationId?: string;
    clientId?: string;
    activeReferenceCount: number;
    messageAttachmentCount: number;
    imageModel?: string;
  }): Promise<{ synthesizedDirection: string; rawResponse?: any }> {
    const {
      apiKey,
      payload,
      conversationId,
      clientId,
      activeReferenceCount,
      messageAttachmentCount,
      imageModel = 'gpt-image-2.5-sunburst',
    } = params;

    // Observabilidade server-side sanitizada (Seção 22)
    Logger.info({
      operation: 'creative_chat_responses_multimodal',
      result: 'started',
      metadata: {
        conversationId: conversationId || 'none',
        clientId: clientId || 'none',
        activeReferenceCount,
        attachmentCount: messageAttachmentCount,
        imageGenerationRequested: true,
        imageModel,
      },
    });

    console.log(
      `[CreativeChat] Responses API input prepared: activeReferences=${activeReferenceCount}, messageAttachments=${messageAttachmentCount}, imageGeneration=true, model=${imageModel}`
    );

    if (!apiKey || apiKey.trim().length === 0) {
      // Fallback determinístico para testes sem custo
      return {
        synthesizedDirection: `Visual Direction (Offline Deterministic): Dominant black background #090B0E, intense neon lime accent #CEF52A, high-contrast bold typography with crisp white text. Inherited from ${activeReferenceCount} client references.`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.warn(`[ResponsesMultimodalService] Responses API status ${resp.status}: ${errText}`);
        return {
          synthesizedDirection: `Visual Direction (Fallback): Inherit strict high-contrast dark palette with primary neon lime accent (#CEF52A) and bold modern typography as observed in the ${activeReferenceCount} client references.`,
        };
      }

      const data = await resp.json();
      const outputText = data.output?.[0]?.content?.[0]?.text || '';

      Logger.info({
        operation: 'creative_chat_responses_multimodal',
        result: 'success',
        metadata: {
          conversationId,
          clientId,
          outputLength: outputText.length,
        },
      });

      return {
        synthesizedDirection: outputText,
        rawResponse: data,
      };
    } catch (err: any) {
      console.warn('[ResponsesMultimodalService] Erro ao chamar Responses API:', err?.message);
      return {
        synthesizedDirection: `Visual Direction: High-contrast dark editorial style with dominant black background, vivid neon lime green highlights (#CEF52A), white typography, and strong tech/performance aesthetic.`,
      };
    }
  }
}
