// tests/client-logos-creative-chat.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';

test('Creative Chat — Seletor e Mandato de Logomarca Oficial', async (t) => {
  await t.test('1. Deve interpretar prompt criativo e manter integridade de formatos', () => {
    const service = new CreativeChatService({} as any);
    const intent = service.interpretCreativePrompt('Gere um post 4:5 com headline: Black Friday');
    assert.equal(intent.format, 'instagram_feed_4_5');
    assert.equal(intent.aspectRatio, '4:5');
    assert.equal(intent.headline, 'Black Friday');
  });

  await t.test('2. Deve incluir regra de logo mandatório quando selectedLogoAsset é fornecido', () => {
    const service = new CreativeChatService({} as any);
    const mockContext = {
      client: { name: 'Fazendo Acontecer' },
      brandProfile: { colors: { primary: ['#090B0E'] } },
    };
    const intent = service.interpretCreativePrompt('Gere um post 4:5');
    
    // Acessa método privado via reflect/cast
    const promptWithLogo = (service as any).compileFullArtPrompt(
      mockContext,
      intent,
      'Gere um post 4:5',
      undefined,
      { label: 'Logo Principal', asset_type: 'logo_primary' }
    );

    assert.ok(
      promptWithLogo.includes('OFFICIAL CLIENT LOGO MANDATE'),
      'Prompt deve conter o mandato de logo oficial'
    );
    assert.ok(
      promptWithLogo.includes('Logo Principal'),
      'Prompt deve referenciar o logo específico do cliente'
    );
  });

  await t.test('3. Não deve incluir mandato de logo quando selectedLogoAsset não for fornecido', () => {
    const service = new CreativeChatService({} as any);
    const mockContext = {
      client: { name: 'Fazendo Acontecer' },
      brandProfile: { colors: { primary: ['#090B0E'] } },
    };
    const intent = service.interpretCreativePrompt('Gere um post 4:5');
    
    const promptWithoutLogo = (service as any).compileFullArtPrompt(
      mockContext,
      intent,
      'Gere um post 4:5',
      undefined,
      undefined
    );

    assert.ok(
      !promptWithoutLogo.includes('OFFICIAL CLIENT LOGO MANDATE'),
      'Prompt sem logo não deve conter mandato de logo'
    );
  });

  await t.test('4. Deve incluir regra mandatória de Objeto Principal / Foto do Cliente quando hasSubjectPhoto for true', () => {
    const service = new CreativeChatService({} as any);
    const mockContext = {
      client: { name: 'Fazendo Acontecer' },
      brandProfile: { colors: { primary: ['#090B0E'] } },
    };
    const intent = service.interpretCreativePrompt('Gere um post 4:5');

    const promptWithSubject = (service as any).compileFullArtPrompt(
      mockContext,
      intent,
      'Gere um post 4:5',
      undefined,
      undefined,
      true
    );

    assert.ok(
      promptWithSubject.includes('MANDATORY HERO SUBJECT / CLIENT PHOTOGRAPHY'),
      'Prompt deve conter o mandato explícito de sujeito herói / foto do cliente'
    );
    assert.ok(
      promptWithSubject.includes('Faithfully preserve their real facial features'),
      'Prompt deve exigir preservação fiel dos traços reais'
    );
  });
});
