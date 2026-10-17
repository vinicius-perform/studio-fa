// tests/visual-analyzer.test.ts
import { describe, it, expect } from 'bun:test';
import { visualAnalyzer } from '@/services/ai/visual-analyzer.service';
import { devStore } from '@/lib/dev-store';

describe('Phase 3 — Bulk Reference Upload & AI Visual Design Analyzer', () => {
  it('correctly detects aspect ratio and format types', () => {
    // 4:5 portrait post
    const feedPortrait = visualAnalyzer.detectFormat(1080, 1350);
    expect(feedPortrait.type).toBe('instagram_post');
    expect(feedPortrait.label).toContain('4:5');

    // 1:1 square post
    const feedSquare = visualAnalyzer.detectFormat(1080, 1080);
    expect(feedSquare.type).toBe('instagram_post');
    expect(feedSquare.label).toContain('1:1');

    // 9:16 story
    const story = visualAnalyzer.detectFormat(1080, 1920);
    expect(story.type).toBe('story');
    expect(story.label).toContain('Story');

    // 16:9 banner
    const banner = visualAnalyzer.detectFormat(1920, 1080);
    expect(banner.type).toBe('cover');
    expect(banner.label).toContain('Banner');

    // Filename clue override
    const namedStory = visualAnalyzer.detectFormat(undefined, undefined, 'arte-story-promocional.png');
    expect(namedStory.type).toBe('story');

    const namedCarousel = visualAnalyzer.detectFormat(undefined, undefined, 'carrossel-slide-1.png');
    expect(namedCarousel.type).toBe('carousel');
  });

  it('generates rich, complete visual analysis with palette, typography, tags and design critique', async () => {
    const analysis = await visualAnalyzer.analyzePiece({
      imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      filename: 'post-lancamento-editorial.png',
      width: 1080,
      height: 1350,
      clientInfo: {
        name: 'Studio Alpha',
        niche: 'Tecnologia & SaaS',
        brandProfile: {
          colors: {
            primary: ['#0F1113'],
            accent: ['#CEF52A'],
            text: ['#FFFFFF'],
            secondary: ['#22262B'],
          },
        },
      },
    });

    expect(analysis.title).toBeDefined();
    expect(analysis.title.length).toBeGreaterThan(5);
    expect(analysis.referenceType).toBe('instagram_post');
    expect(analysis.tags.length).toBeGreaterThanOrEqual(4);
    expect(analysis.aiDescription).toBeDefined();
    expect(analysis.aiDescription).toContain('Studio Alpha');
    expect(analysis.visualFeatures.dominantColors.length).toBeGreaterThanOrEqual(2);
    expect(analysis.visualFeatures.dominantColors).toContain('#0F1113');
    expect(analysis.visualFeatures.dominantColors).toContain('#CEF52A');
    expect(analysis.visualFeatures.typographyStyle).toBeDefined();
    expect(analysis.visualFeatures.layoutDensity).toBe('editorial');
    expect(analysis.visualFeatures.contrastLevel).toBe('alto');
    expect(analysis.qualityScore).toBeGreaterThanOrEqual(9.0);
  });

  it('persists AI-analyzed reference pieces in devStore with visual features and tags', () => {
    const orgId = devStore.getOrganizationId();
    const clientId = 'c-test-visual-analyzer';

    const ref = devStore.addBrandReference({
      organization_id: orgId,
      client_id: clientId,
      title: 'Post Feed Editorial Analisado',
      description: 'Análise detalhada de composição e hierarquia.',
      reference_type: 'instagram_post',
      tags: ['minimalista', 'fundo_escuro', 'neon'],
      image_url: 'data:image/png;base64,mock',
      ai_description: 'Análise de contraste e tipografia.',
      visual_features: {
        dominantColors: ['#0F1113', '#CEF52A'],
        typographyStyle: 'Sans-serif geométrica',
        layoutDensity: 'editorial',
      },
    });

    expect(ref.id).toBeDefined();
    expect(ref.title).toBe('Post Feed Editorial Analisado');
    expect(ref.ai_description).toBe('Análise de contraste e tipografia.');
    expect(ref.visual_features.dominantColors).toEqual(['#0F1113', '#CEF52A']);

    const list = devStore.listBrandReferences(clientId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].visual_features).toBeDefined();

    // Clean up
    devStore.deleteBrandReference(ref.id);
  });
});
