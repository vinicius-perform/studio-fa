// tests/visual-memory-generation.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ResponsesMultimodalService,
  MANDATORY_SYSTEM_VISUAL_RULE,
  type MultimodalImageInput,
} from '../src/services/ai/responses-multimodal.service';

describe('HOTFIX: Memória Visual na Geração Multimodal da Responses API', () => {
  // Cria referências simuladas determinísticas (13 peças totais)
  const mockPieceBuffers: MultimodalImageInput[] = Array.from({ length: 13 }, (_, i) => ({
    id: `piece-${i + 1}`,
    buffer: Buffer.from(`fake-png-binary-data-piece-${i + 1}`),
    mimeType: 'image/png',
    title: `Peça de Referência ${i + 1}`,
    isPrimary: i === 0, // A primeira é primária
    kind: 'brand_reference' as const,
  }));

  it('1. Cliente possui 13 refs e 12 estão selecionadas -> monta exatamente 12 input_image', () => {
    const selected12 = mockPieceBuffers.slice(0, 12);
    assert.strictEqual(selected12.length, 12);

    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: '15 mensagens para sua secretária recuperar paciente perdido',
      brandReferences: selected12,
    });

    const userContent = payload.input[0].content;
    const textItems = userContent.filter((c) => c.type === 'input_text');
    const imageItems = userContent.filter((c) => c.type === 'input_image');

    assert.strictEqual(textItems.length, 1, 'Deve conter 1 item de instrução textual');
    assert.strictEqual(imageItems.length, 12, 'Deve conter exatamente 12 input_image das referências ativas');

    // Valida que todos os 12 itens contêm o prefixo Data URL correto
    for (let i = 0; i < 12; i++) {
      assert.ok(
        imageItems[i].image_url?.startsWith('data:image/png;base64,'),
        `Item ${i} deve ser um Data URL base64 válido`
      );
    }

    // Valida menção explícita no texto
    assert.ok(textItems[0].text?.includes('Exactly 12 client visual references are attached below as input_image'));
  });

  it('2. Seleção muda de 12 para 5 -> monta exatamente 5 input_image', () => {
    const selected5 = mockPieceBuffers.slice(0, 5);
    assert.strictEqual(selected5.length, 5);

    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Crie um post institucional com visual dark',
      brandReferences: selected5,
    });

    const userContent = payload.input[0].content;
    const imageItems = userContent.filter((c) => c.type === 'input_image');

    assert.strictEqual(imageItems.length, 5, 'Deve conter exatamente 5 input_image quando 5 peças estiverem selecionadas');
    assert.ok(userContent[0].text?.includes('Exactly 5 client visual references are attached below'));
  });

  it('3. 12 refs de marca + 1 upload da mensagem -> monta 12 brand refs + 1 message attachment', () => {
    const selected12 = mockPieceBuffers.slice(0, 12);
    const layoutPrintUpload: MultimodalImageInput = {
      id: 'upload-print-layout',
      buffer: Buffer.from('fake-layout-print-screenshot-bytes'),
      mimeType: 'image/png',
      isLayoutPrint: true,
      kind: 'message_attachment',
      title: 'Print de Estrutura de Layout',
    };

    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Use esse print como base de estrutura para o post',
      brandReferences: selected12,
      messageAttachments: [layoutPrintUpload],
    });

    const userContent = payload.input[0].content;
    const imageItems = userContent.filter((c) => c.type === 'input_image');

    assert.strictEqual(imageItems.length, 13, 'Total de imagens anexadas deve ser 13 (12 marcas + 1 print de layout)');
    assert.ok(userContent[0].text?.includes('MESSAGE ATTACHMENTS: 1 user attachment(s) are included'));
    assert.ok(userContent[0].text?.includes('Exactly 12 client visual references are attached below'));
  });

  it('4. 0 refs selecionadas -> sem input_image de memória de marca', () => {
    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Post simples sem referências ativas',
      brandReferences: [],
      messageAttachments: [],
    });

    const userContent = payload.input[0].content;
    const imageItems = userContent.filter((c) => c.type === 'input_image');

    assert.strictEqual(imageItems.length, 0, 'Não deve conter nenhum input_image quando 0 referências estiverem ativas');
    assert.ok(userContent[0].text?.includes('NOTICE: No client visual references attached'));
  });

  it('5. Referência primária é enviada em primeiro lugar', () => {
    // Coloca a primária na 3ª posição do array de entrada
    const unarrangedRefs: MultimodalImageInput[] = [
      { id: 'ref-normal-1', buffer: Buffer.from('b1'), mimeType: 'image/png', isPrimary: false, kind: 'brand_reference' },
      { id: 'ref-normal-2', buffer: Buffer.from('b2'), mimeType: 'image/png', isPrimary: false, kind: 'brand_reference' },
      { id: 'ref-primary', buffer: Buffer.from('primary-brand-bytes'), mimeType: 'image/png', isPrimary: true, kind: 'brand_reference' },
    ];

    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Post com referência principal destacada',
      brandReferences: unarrangedRefs,
    });

    const userContent = payload.input[0].content;
    const imageItems = userContent.filter((c) => c.type === 'input_image');

    const expectedPrimaryBase64 = Buffer.from('primary-brand-bytes').toString('base64');
    assert.ok(
      imageItems[0].image_url?.includes(expectedPrimaryBase64),
      'O primeiro item de imagem no input_image DEVE ser a referência primária'
    );
  });

  it('6. Mandato de sistema proíbe estética genérica e impõe linguagem das referências', () => {
    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Teste de prompt de sistema',
      brandReferences: mockPieceBuffers.slice(0, 1),
    });

    assert.ok(payload.instructions.includes('Do not replace the client\'s visual language with generic AI aesthetics.'));
    assert.ok(payload.instructions.includes('If the brand uses black and neon lime green with bold editorial typography, do NOT introduce generic blue/purple neon cyberpunk aesthetics.'));
    assert.ok(payload.instructions.includes('The first attached reference is the primary visual direction.'));
  });
});
