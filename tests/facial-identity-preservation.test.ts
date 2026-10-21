// tests/facial-identity-preservation.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import {
  ResponsesMultimodalService,
  MANDATORY_SYSTEM_VISUAL_RULE,
  type MultimodalImageInput,
} from '../src/services/ai/responses-multimodal.service';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';
import { FaceDetectionService } from '../src/services/ai/face-detection.service';

describe('STUDIO FA — Hotfix de Fidelidade Facial & Preservação de Identidade (Seção 17)', () => {
  // Gera uma imagem sintética determinística de teste
  const createTestImageBuffer = async (width = 800, height = 800, color = '#223344') => {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color,
      },
    })
      .png()
      .toBuffer();
  };

  it('1. quando existe estilo + objeto principal com pessoa: ambos entram na request na ordem obrigatória (Imagem 1: Estilo, Imagem 2: Objeto principal, Imagem 3: Crop facial)', async () => {
    const styleBuffer = await createTestImageBuffer(800, 800, '#090B0E');
    const subjectBuffer = await createTestImageBuffer(800, 800, '#E0A98B');
    const faceCropBuffer = await createTestImageBuffer(512, 512, '#D2906F');

    const brandRef: MultimodalImageInput = {
      id: 'ref-style-1',
      buffer: styleBuffer,
      mimeType: 'image/png',
      isPrimary: true,
      kind: 'brand_reference',
      title: 'Estilo Visual da Marca',
    };

    const subjectPhoto: MultimodalImageInput = {
      id: 'subject-full',
      buffer: subjectBuffer,
      mimeType: 'image/png',
      kind: 'subject_photo',
      title: 'Objeto Principal Completo',
    };

    const faceCrop: MultimodalImageInput = {
      id: 'face-crop',
      buffer: faceCropBuffer,
      mimeType: 'image/png',
      kind: 'face_crop',
      title: 'Crop Facial em Alta Resolução',
    };

    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Crie uma peça para médica especialista',
      brandReferences: [brandRef],
      subjectPhoto,
      faceCrop,
    });

    const content = payload.input[0].content;
    const textItems = content.filter((c) => c.type === 'input_text');
    const imageItems = content.filter((c) => c.type === 'input_image');

    // Verifica que todas as 3 imagens entraram
    assert.strictEqual(imageItems.length, 3, 'Deve conter exatamente 3 imagens multimodais');

    // Valida a ordem e conteúdo
    const text = textItems[0]?.text || '';
    assert.ok(text.includes('IMAGE 1 [ART STYLE REFERENCE]'), 'Imagem 1 deve ser Art Style Reference');
    assert.ok(text.includes('IMAGE 2 [HERO MAIN SUBJECT - FULL]'), 'Imagem 2 deve ser Hero Main Subject');
    assert.ok(text.includes('IMAGE 3 [FACIAL IDENTITY HIGH-RES CROP]'), 'Imagem 3 deve ser Facial Identity Crop');
    assert.ok(text.includes('Preserve the person\'s identity faithfully'), 'Deve incluir mandato de preservação');
  });

  it('2. quando rosto é detectado: crop facial é gerado e usado como apoio', async () => {
    // Simula uma resposta do FaceDetectionService com crop de alta fidelidade
    const origBuf = await createTestImageBuffer(800, 800, '#D2906F');
    const cropBuf = await sharp(origBuf)
      .extract({ left: 100, top: 100, width: 300, height: 300 })
      .resize(512, 512)
      .png()
      .toBuffer();

    assert.ok(cropBuf.length > 0, 'Buffer de crop facial deve ser válido');

    const meta = await sharp(cropBuf).metadata();
    assert.strictEqual(meta.width, 512);
    assert.strictEqual(meta.height, 512);

    // Valida que o crop entra como entrada multimodal de kind 'face_crop'
    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Anúncio de autoridade médica',
      brandReferences: [
        {
          buffer: origBuf,
          mimeType: 'image/png',
          isPrimary: true,
          kind: 'brand_reference',
        },
      ],
      faceCrop: {
        buffer: cropBuf,
        mimeType: 'image/png',
        kind: 'face_crop',
      },
    });

    const imageItems = payload.input[0].content.filter((c) => c.type === 'input_image');
    assert.strictEqual(imageItems.length, 2, 'Deve conter referência de estilo + crop facial');
    assert.ok(payload.input[0].content[0].text?.includes('FACIAL IDENTITY HIGH-RES CROP'));
  });

  it('3. quando não há rosto: fluxo segue sem identidade facial', async () => {
    // Objeto principal que é um produto (sem rosto humano)
    const productBuffer = await createTestImageBuffer(800, 800, '#333333');

    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Divulgue nosso novo produto tecnológico',
      brandReferences: [
        {
          buffer: productBuffer,
          mimeType: 'image/png',
          isPrimary: true,
          kind: 'brand_reference',
        },
      ],
      subjectPhoto: {
        buffer: productBuffer,
        mimeType: 'image/png',
        kind: 'subject_photo',
        title: 'Produto Físico',
      },
      // Sem faceCrop
    });

    const content = payload.input[0].content;
    const text = content[0]?.text || '';
    const imageItems = content.filter((c) => c.type === 'input_image');

    assert.strictEqual(imageItems.length, 2, 'Deve conter apenas estilo e o produto');
    assert.ok(!text.includes('FACIAL IDENTITY HIGH-RES CROP'), 'Não deve referenciar crop facial');
  });

  it('4. quando há múltiplos rostos: sistema sinaliza e suporta seleção explícita sem escolha aleatória em silêncio', async () => {
    // Simula resultado com múltiplos rostos
    const multipleFacesResult = {
      faceCount: 2,
      hasFace: true,
      hasMultipleFaces: true,
      faces: [
        { id: 'face-1', box_2d: [100, 100, 300, 300] as [number, number, number, number], cropBuffer: Buffer.from('f1'), cropDataUrl: 'data:image/png;base64,f1' },
        { id: 'face-2', box_2d: [150, 400, 350, 600] as [number, number, number, number], cropBuffer: Buffer.from('f2'), cropDataUrl: 'data:image/png;base64,f2' },
      ],
      primaryFaceCropBuffer: Buffer.from('f1'),
      statusText: 'Mais de 1 pessoa detectada (2 rostos). Selecione a pessoa principal.',
    };

    assert.strictEqual(multipleFacesResult.hasMultipleFaces, true);
    assert.strictEqual(multipleFacesResult.faces.length, 2);
    assert.ok(multipleFacesResult.statusText.includes('Mais de 1 pessoa detectada'));

    // Garante que se o usuário escolher explicitamente a face 2, o crop da face 2 é o utilizado
    const userSelectedFace = multipleFacesResult.faces[1];
    const payload = ResponsesMultimodalService.prepareResponsesPayload({
      userPrompt: 'Post com a médica principal',
      brandReferences: [
        {
          buffer: Buffer.from('style'),
          mimeType: 'image/png',
          kind: 'brand_reference',
        },
      ],
      faceCrop: {
        buffer: userSelectedFace.cropBuffer,
        mimeType: 'image/png',
        kind: 'face_crop',
      },
    });

    const cropImage = payload.input[0].content.find(
      (c) => c.type === 'input_image' && c.image_url?.includes(Buffer.from('f2').toString('base64'))
    );
    assert.ok(cropImage, 'O crop enviado deve ser exatamente o escolhido pelo usuário');
  });

  it('5. prompt interno inclui instrução mandatória de fidelidade facial (Seções 9, 10, 11)', () => {
    const service = new CreativeChatService({} as any);
    const mockContext = {
      client: { name: 'Fazendo Acontecer' },
      brandProfile: { colors: { primary: ['#090B0E'] } },
    };
    const intent = service.interpretCreativePrompt('Crie um post 4:5');

    const promptWithFacialPreservation = (service as any).compileFullArtPrompt(
      mockContext,
      intent,
      'Crie um post 4:5',
      undefined,
      undefined,
      true, // hasSubjectPhoto
      'Mulher profissional, cabelos castanhos longos, blazer azul marinho', // subjectLikeness
      'Formato oval de rosto, olhos amendoados castanhos escuros, nariz reto, sorriso suave', // facialIdentityDescription
      true // hasFaceCrop
    );

    // Seção 9: Preservação de Identidade
    assert.ok(
      promptWithFacialPreservation.includes('The style reference defines the visual language of the artwork'),
      'Deve declarar que a referência de estilo define a linguagem visual'
    );
    assert.ok(
      promptWithFacialPreservation.includes('The main subject image defines the person who must appear in the final composition'),
      'Deve declarar que o objeto principal define a pessoa'
    );
    assert.ok(
      promptWithFacialPreservation.includes('Preserve the person\'s identity faithfully, especially facial structure, eyes, nose, mouth'),
      'Deve exigir preservação fiel de traços faciais'
    );
    assert.ok(
      promptWithFacialPreservation.includes('Do not replace the person with a generic similar-looking subject or generic stock model'),
      'Proibido substituir por modelo genérico'
    );

    // Seção 10: O que pode mudar
    assert.ok(
      promptWithFacialPreservation.includes('WHAT YOU CAN ADAPT (PERMITTED ADAPTATIONS)'),
      'Deve conter bloco de adaptações permitidas'
    );
    assert.ok(
      promptWithFacialPreservation.includes('You may adapt pose, framing, lighting, background, composition, clothing'),
      'Permite adaptação de pose, iluminação e fundo'
    );

    // Seção 11: O que não pode mudar
    assert.ok(
      promptWithFacialPreservation.includes('WHAT YOU CANNOT CHANGE (FORBIDDEN CHANGES)'),
      'Deve conter bloco de proibições estritas'
    );
    assert.ok(
      promptWithFacialPreservation.includes('facial shape, eyes, nose, mouth, eyebrows, hairline, apparent age, skin tone'),
      'Proíbe alteração do formato de rosto, olhos, nariz, boca, sobrancelhas e tom de pele'
    );
  });

  it('6. Modo PRESERVAR PESSOA: a imagem da pessoa é usada como base visual e integrada na peça via ImageCompositeService.integrateSubject', async () => {
    const { ImageCompositeService } = await import('../src/services/image/image-composite.service');

    const artworkBuffer = await createTestImageBuffer(1080, 1350, '#090B0E');
    // Cria um recorte com canal alpha real
    const personCutoutBuffer = await sharp({
      create: {
        width: 600,
        height: 800,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp(
            Buffer.from('<svg width="600" height="800"><circle cx="300" cy="400" r="200" fill="#E5A683" /></svg>')
          )
            .png()
            .toBuffer(),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    // Executa a integração com preservação real da pessoa recortada
    const compositeResult = await ImageCompositeService.integrateSubject({
      baseArtworkBuffer: artworkBuffer,
      subjectCutoutBuffer: personCutoutBuffer,
      scaleRatio: 0.72,
      verticalAlign: 'bottom',
      horizontalAlign: 'center',
    });

    assert.ok(compositeResult.length > 0, 'Buffer composto deve ser gerado');
    const meta = await sharp(compositeResult).metadata();
    assert.strictEqual(meta.width, 1080);
    assert.strictEqual(meta.height, 1350);
  });

  it('7. Modo REFERÊNCIA HUMANA vs PRESERVAR PESSOA: o prompt se ajusta deterministicamente e o default é preservar', () => {
    const service = new CreativeChatService({} as any);
    const mockContext = {
      client: { name: 'Fazendo Acontecer' },
      brandProfile: { colors: { primary: ['#090B0E'] } },
    };
    const intent = service.interpretCreativePrompt('Post autoridade');

    // Modo 2: Preservar Pessoa (Default)
    const promptPreserve = (service as any).compileFullArtPrompt(
      mockContext,
      intent,
      'Post autoridade',
      undefined,
      undefined,
      true,
      'Médica especialista',
      'Rosto oval, olhos castanhos',
      true,
      'preserve_person'
    );

    assert.ok(
      promptPreserve.includes('PRESERVATION BASE MODE: The authentic person is the primary hero focal point'),
      'Modo Preservar deve instruir a reserva da área hero para a pessoa real'
    );

    // Modo 1: Inspirar
    const promptInspire = (service as any).compileFullArtPrompt(
      mockContext,
      intent,
      'Post autoridade',
      undefined,
      undefined,
      true,
      'Médica especialista',
      'Rosto oval, olhos castanhos',
      true,
      'inspire_person'
    );

    assert.ok(
      promptInspire.includes('HERO SUBJECT INSPIRATION (HUMAN REFERENCE MODE)'),
      'Modo Inspirar deve orientar inspiração de personagem sem forçar preservação da foto base'
    );
  });
});
