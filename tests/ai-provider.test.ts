// tests/ai-provider.test.ts
import { describe, expect, it } from 'bun:test';
import { OpenAIProvider } from '@/services/ai/openai.provider';

describe('AI Foundation & Provider Abstraction', () => {
  const provider = new OpenAIProvider();

  it('reads model configurations dynamically without hardcoding', () => {
    const models = provider.getConfiguredModels();
    expect(models.vision).toBeDefined();
    expect(models.image).toBeDefined();
    expect(models.embedding).toBe('text-embedding-3-small');
  });

  it('generates 1536-dimensional normalized embeddings for vector search', async () => {
    const embedding = await provider.createEmbedding({
      text: 'Studio FA brand memory and references',
    });

    expect(embedding.length).toBe(1536);

    // Verify normalization (|v| ~= 1)
    const magnitude = Math.sqrt(embedding.reduce((acc, v) => acc + v * v, 0));
    expect(Math.abs(magnitude - 1)).toBeLessThan(0.001);
  });

  it('safely generates images with Zero-Cost local fallback when API key is unconfigured', async () => {
    const res = await provider.generateImage({
      prompt: 'test prompt',
      brandProfile: { colors: { primary: ['#0B0F17'], accent: ['#CEF52A'] } } as any,
      dimensions: { width: 1088, height: 1360 },
    });

    expect(res).toBeDefined();
    expect(res.imageUrl).toContain('data:image/svg+xml');
    expect(res.costUsd).toBe(0.0);
  });

  it('safely performs image edits with Zero-Cost local fallback when API key is unconfigured', async () => {
    const res = await provider.editImage({
      sourceImageUrl: 'https://example.com/source.png',
      instructionPrompt: 'make background darker',
      brandProfile: { colors: { primary: ['#0B0F17'], accent: ['#CEF52A'] } } as any,
    });

    expect(res).toBeDefined();
    expect(res.imageUrl).toContain('data:image/svg+xml');
    expect(res.costUsd).toBe(0.0);
  });

  it('reads API key dynamically from devStore when set', () => {
    const { devStore } = require('@/lib/dev-store');
    const originalEnv = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    devStore.setSetting('openai_api_key', 'sk-test-from-devstore-123456');
    expect(provider.isConfigured()).toBe(true);

    // Clean up
    devStore.setSetting('openai_api_key', '');
    if (originalEnv) {
      process.env.OPENAI_API_KEY = originalEnv;
    }
  });
});
