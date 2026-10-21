// src/services/ai/prompt-compiler.ts
import type { BrandProfile } from '@/types/domain/brand';
import type { SlidePlan, GlobalCreativeDirection } from '@/types/domain/creative-plan';
import type { FormatDefinition } from '@/config/formats';

export interface PromptCompilerInput {
  brandProfile: BrandProfile;
  format: FormatDefinition;
  slidePlan: Partial<SlidePlan> & {
    visualConcept: string;
    layout: {
      title: { x: number; y: number; width: number; align: string };
    };
  };
  globalDirection?: GlobalCreativeDirection;
  content: {
    title?: string;
    subtitle?: string;
    body?: string;
    cta?: string;
    instructions?: string;
  };
  hasBaseImage?: boolean;
  baseImageStrategy?: 'preserve_photo' | 'edit_photo_ai' | 'generate_new_image';
  pinnedReferencesDescriptions?: string[];
  referenceImageUrl?: string;
  referenceTitle?: string;
  customVariationInstruction?: string;
}

export interface CompiledPromptResult {
  prompt: string;
  version: string;
  negativeSpaceInstruction: string;
  sections: {
    objective: string;
    brandDirection: string;
    scene: string;
    composition: string;
    photography: string;
    color: string;
    graphicStyle: string;
    referenceGuidance: string;
    constraints: string;
    doNot: string;
  };
}

export class PromptCompiler {
  public static readonly VERSION = 'image_generation_v1';

  /**
   * Compiles the modular image prompt with explicit negative space and strict prohibition of text baking.
   */
  public static compile(input: PromptCompilerInput): CompiledPromptResult {
    const { brandProfile, format, slidePlan, content, pinnedReferencesDescriptions } = input;

    // 1. Calculate negative space based on text layout coordinates
    const titleLayout = slidePlan.layout.title;
    let negativeSpace = 'Clean negative space on the upper-left area for typographic overlay';

    if (titleLayout.x < 0.35 && titleLayout.width <= 0.6) {
      negativeSpace = 'Clean, uncluttered negative space on the entire LEFT half of the canvas for typography. Position subjects, focal points, and lighting towards the RIGHT side.';
    } else if (titleLayout.x > 0.4) {
      negativeSpace = 'Clean, uncluttered negative space on the entire RIGHT half of the canvas for typography. Position subjects and focal points towards the LEFT side.';
    } else if (titleLayout.y > 0.5) {
      negativeSpace = 'Clean negative space across the LOWER section of the image for headline overlays. Keep primary scene elements in the upper section.';
    } else if (titleLayout.y < 0.35) {
      negativeSpace = 'Clean negative space across the TOP-LEFT section of the image for headline overlays. Keep primary scene elements towards center and bottom.';
    }

    // 2. Color direction
    const primaryColors = brandProfile.colors?.primary?.join(', ') || '#0B0F17, #1F2937';
    const accentColor = brandProfile.colors?.accent?.join(', ') || '#CEF52A';
    const bgColors = brandProfile.colors?.background?.join(', ') || '#0A0A0A, #111827';

    // 3. Sections
    const objective = `Create a high-end commercial visual background for a ${format.name} (${format.aspectRatio}) social media publication. Slide context: ${slidePlan.visualConcept}. Content context: ${content.title ? `"${content.title}"` : 'Editorial post'}.`;

    const brandDirection = `Aesthetic: ${brandProfile.summary || 'Modern corporate'}. Mood: ${brandProfile.visualStyle?.mood?.join(', ') || 'Sophisticated, modern, corporate'}. Keywords: ${brandProfile.visualStyle?.keywords?.join(', ') || 'Minimalist, premium'}. Contrast: ${brandProfile.visualStyle?.contrast || 'Balanced'}.`;

    let scene = `Scene setting: ${slidePlan.imagePrompt || content.title || 'Sophisticated visual scene'}. Visual focus: generate an original commercial background expressing the theme "${content.title || 'Inovação e eficiência'}".`;
    if (input.referenceTitle) {
      scene += ` Inspired by reference piece concept: "${input.referenceTitle}".`;
    }
    if (input.customVariationInstruction) {
      scene += ` Variation override instruction: ${input.customVariationInstruction}.`;
    }
    if (content.instructions) {
      scene += ` Designer specific directive: ${content.instructions}.`;
    }

    const composition = `Canvas aspect ratio is strictly ${format.aspectRatio} (${format.generationWidth}x${format.generationHeight}). ${negativeSpace}. Visual hierarchy must allow high-contrast typography to be placed on top without visual clash.`;

    const photography = `Lighting: ${brandProfile.photography?.lighting || 'Soft natural directional lighting'}. Photographic style: ${brandProfile.photography?.style || 'High-end editorial studio'}. Treatment: ${brandProfile.photography?.treatment || 'Clean balanced tones, natural textures, zero harsh plastic artifacts'}.`;

    const color = `Color palette: Primary tones (${primaryColors}), background ambient (${bgColors}), subtle accent lighting or elements in ${accentColor}. Avoid garish oversaturated neon tones.`;

    const graphicStyle = `Subtle graphic elements: ${brandProfile.graphicalElements?.patterns?.join(', ') || 'Minimalist architectural shapes, clean gradients, elegant textures'}.`;

    const refDescriptions = [...(pinnedReferencesDescriptions || [])];
    if (input.referenceTitle) {
      refDescriptions.unshift(`Artistic concept, lighting and visual atmosphere inspired by: "${input.referenceTitle}"`);
    }

    const referenceGuidance = refDescriptions.length > 0
      ? `Visual reference guidance: Match the sophisticated mood, lighting, textures and creative metaphor of: ${refDescriptions.join('; ')}. Recreate a brand-new original artwork inspired by this visual concept, without copying any of the original layout's text or watermarks.`
      : 'Maintain visual consistency with the approved Brand DNA.';

    const constraints = `Ensure edge-to-edge balance suited for mobile screens. Keep focal elements within safe zone (margins: top ${format.safeArea.top}px, bottom ${format.safeArea.bottom}px).`;

    // Strict DO NOT section (Prompt Section 54)
    const doNot = `DO NOT render any text, typography, letters, headlines, subtitles, logos, icons with text, watermarks, signatures, or UI overlays inside the image. The typography will be rendered programmatically by the design studio. The image MUST provide intentional negative space for external text placement.`;

    const fullPrompt = [
      `[OBJECTIVE]\n${objective}`,
      `[BRAND DIRECTION]\n${brandDirection}`,
      `[SCENE]\n${scene}`,
      `[COMPOSITION & NEGATIVE SPACE]\n${composition}`,
      `[PHOTOGRAPHY & LIGHTING]\n${photography}`,
      `[COLOR PALETTE]\n${color}`,
      `[GRAPHIC STYLE]\n${graphicStyle}`,
      `[REFERENCE GUIDANCE]\n${referenceGuidance}`,
      `[CONSTRAINTS]\n${constraints}`,
      `[STRICT DO NOT]\n${doNot}`,
    ].join('\n\n');

    return {
      prompt: fullPrompt,
      version: PromptCompiler.VERSION,
      negativeSpaceInstruction: negativeSpace,
      sections: {
        objective,
        brandDirection,
        scene,
        composition,
        photography,
        color,
        graphicStyle,
        referenceGuidance,
        constraints,
        doNot,
      },
    };
  }

  /**
   * Compila o prompt oficial a partir do CreativeContext da Fase C,
   * garantindo Anti-Text Baking absoluto e respeito às safe zones.
   */
  public static compileFromCreativeContext(
    context: import('@/types/domain/creative-engine').CreativeContext,
    safeZones?: import('@/types/domain/creative-engine').SlideSafeZones
  ): CompiledPromptResult {
    const { format, exactContent, compactBrandContext, selectedReferences, clientName, manualRules } = context;

    // 1. Zonas de Segurança e Espaço Negativo
    const headlineZone = safeZones?.headlineZone || { x: 0.08, y: 0.25, width: 0.75, height: 0.35 };
    let negativeSpace = 'Clean negative space on the upper-left area for typographic overlay';

    if (headlineZone.x < 0.35 && headlineZone.width <= 0.6) {
      negativeSpace = 'Clean, uncluttered negative space on the entire LEFT half of the canvas for typography. Position subjects, focal points, and lighting towards the RIGHT side.';
    } else if (headlineZone.x > 0.4) {
      negativeSpace = 'Clean, uncluttered negative space on the entire RIGHT half of the canvas for typography. Position subjects and focal points towards the LEFT side.';
    } else if (headlineZone.y > 0.5) {
      negativeSpace = 'Clean negative space across the LOWER section of the image for headline overlays. Keep primary scene elements in the upper section.';
    } else if (headlineZone.y < 0.35) {
      negativeSpace = 'Clean negative space across the TOP-LEFT section of the image for headline overlays. Keep primary scene elements towards center and bottom.';
    }

    // 2. Cores da Marca
    const primColors = compactBrandContext.palette.primary.join(', ') || '#0B0F17';
    const accColor = compactBrandContext.palette.accent[0] || '#CEF52A';
    const bgColors = compactBrandContext.palette.background.join(', ') || '#0A0A0A';

    // 3. Seções estruturadas
    const objective = `Create a high-end commercial visual background for a ${format.name} (${format.aspectRatio}) publication for "${clientName}". Theme: ${exactContent.title ? `"${exactContent.title}"` : 'Editorial post'}.`;

    const brandDirection = [
      `Aesthetic: ${compactBrandContext.mood.join(', ') || 'Sophisticated and modern'}.`,
      `Typography Character: ${compactBrandContext.typographyCharacter}.`,
      manualRules.length > 0 ? `Mandatory Rules: ${manualRules.join('; ')}.` : '',
    ].filter(Boolean).join(' ');

    let scene = `Scene setting: ${exactContent.title || 'Sophisticated commercial visual scene'}. Focus: generate an original commercial background expressing "${exactContent.title || 'Inovação e eficiência'}".`;
    if (exactContent.userVisualDirection) {
      scene += ` Designer Specific Directive: "${exactContent.userVisualDirection}".`;
    }

    const composition = `Canvas aspect ratio is strictly ${format.aspectRatio} (${format.generationWidth}x${format.generationHeight}). ${negativeSpace}. Visual hierarchy must allow high-contrast typography to be placed on top without visual clash.`;

    const photography = `Lighting: ${compactBrandContext.imagery.lighting || 'Soft natural directional lighting'}. Photographic style: ${compactBrandContext.imagery.imageType || 'High-end editorial studio'}. Treatment: ${compactBrandContext.imagery.treatment || 'Clean balanced tones, natural textures, zero harsh plastic artifacts'}.`;

    const color = `Color palette: Primary tones (${primColors}), background ambient (${bgColors}), subtle accent lighting or elements in ${accColor}. Avoid garish oversaturated neon tones.`;

    const graphicStyle = `Subtle graphic elements: ${compactBrandContext.doRules?.join('; ') || 'Minimalist architectural shapes, clean gradients, elegant textures'}.`;

    // 4. Orientação de Referências
    let referenceGuidance = 'Maintain visual consistency with the approved Brand DNA.';
    if (selectedReferences.length > 0) {
      const primaryRef = selectedReferences.find((r) => r.isPrimary) || selectedReferences[0];
      const refTitle = primaryRef.title || 'Peça institucional';
      const refDetails = primaryRef.analysis
        ? `Palette: ${primaryRef.analysis.colors?.palette?.join(', ') || ''}; Composition: ${primaryRef.analysis.composition?.visualDensity || ''}`
        : '';
      referenceGuidance = `Visual reference guidance: Inspired by primary reference "${refTitle}" (${refDetails}). Match the sophisticated mood, lighting, textures and creative metaphor. Recreate a brand-new original artwork without copying any of the original layout's text or watermarks.`;
    }

    const constraints = `Ensure edge-to-edge balance suited for mobile screens. Keep focal elements away from reserved text safe zones.`;

    // 5. Anti-Text Baking Estrito (Regra Central da Fase C)
    const doNot = `NO TYPOGRAPHY. NO WORDS. NO LETTERS. NO NUMBERS. NO LOGOS. NO BRAND NAMES. NO CAPTIONS. NO WATERMARKS. DO NOT render any text, typography, letters, headlines, subtitles, logos, icons with text, watermarks, signatures, or UI overlays inside the image. The typography will be rendered programmatically by the design studio. The image MUST provide intentional negative space for external text placement.`;

    const fullPrompt = [
      `[OBJECTIVE]\n${objective}`,
      `[BRAND DIRECTION]\n${brandDirection}`,
      `[SCENE]\n${scene}`,
      `[COMPOSITION & NEGATIVE SPACE]\n${composition}`,
      `[PHOTOGRAPHY & LIGHTING]\n${photography}`,
      `[COLOR PALETTE]\n${color}`,
      `[GRAPHIC STYLE]\n${graphicStyle}`,
      `[REFERENCE GUIDANCE]\n${referenceGuidance}`,
      `[CONSTRAINTS]\n${constraints}`,
      `[STRICT DO NOT]\n${doNot}`,
    ].join('\n\n');

    return {
      prompt: fullPrompt,
      version: PromptCompiler.VERSION,
      negativeSpaceInstruction: negativeSpace,
      sections: {
        objective,
        brandDirection,
        scene,
        composition,
        photography,
        color,
        graphicStyle,
        referenceGuidance,
        constraints,
        doNot,
      },
    };
  }
}

