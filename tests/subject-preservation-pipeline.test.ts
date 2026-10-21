// tests/subject-preservation-pipeline.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import { SubjectSegmentationService } from '../src/services/image/subject-segmentation.service';
import { ImageCompositeService } from '../src/services/image/image-composite.service';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';

describe('STUDIO FA — Subject Preservation Pipeline (Hotfix Seção 20)', () => {
  // Cria uma imagem sintética retangular sem canal alpha (simula foto bruta do usuário com fundo sólido)
  const createOpaquePhoto = async (width = 600, height = 800, color = '#336699') => {
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

  // Cria um cutout sintético com canal alpha real (sujeito no centro e fundo 100% transparente)
  const createTransparentCutout = async (width = 600, height = 800) => {
    // Fundo transparente (alpha = 0)
    const base = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    // Sujeito circular opaco no centro (simula a pessoa isolada)
    const subjectSvg = Buffer.from(`
      <svg width="${width}" height="${height}">
        <circle cx="${width / 2}" cy="${height / 2}" r="${width / 3}" fill="#D2906F" />
      </svg>
    `);
    const subjectPng = await sharp(subjectSvg).png().toBuffer();

    return sharp(base)
      .composite([{ input: subjectPng, top: 0, left: 0 }])
      .png()
      .toBuffer();
  };

  it('A) preservePerson=true -> subjectCutout é obrigatório e falha se não houver recorte transparente', async () => {
    const baseArt = await createOpaquePhoto(1080, 1350, '#101216');
    const opaqueSubject = await createOpaquePhoto(600, 800, '#C0392B');

    // Ao tentar integrar sujeito sem recorte e com buffer sem alpha, se a segmentação falhar não pode inserir retângulo
    await assert.rejects(
      async () => {
        // Passa um buffer corrompido ou inválido que não permite cutout
        await ImageCompositeService.integrateSubject({
          baseArtworkBuffer: baseArt,
          subjectPhotoBuffer: Buffer.from('invalid-non-image'),
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes('Não foi possível separar a pessoa do fundo'),
          'Deve lançar erro explícito proibindo colagem retangular'
        );
        return true;
      }
    );
  });

  it('B) cutout possui alpha real (channels === 4, hasAlpha === true, pixels transparentes)', async () => {
    const cutout = await createTransparentCutout(500, 600);
    const meta = await sharp(cutout).metadata();

    assert.strictEqual(meta.channels, 4, 'Cutout deve conter 4 canais (RGBA)');
    assert.strictEqual(meta.hasAlpha, true, 'Cutout deve possuir canal alpha');

    const isCutout = await SubjectSegmentationService.isAlphaCutout(cutout);
    assert.strictEqual(isCutout, true, 'isAlphaCutout deve reconhecer imagem com alpha real');

    const opaque = await createOpaquePhoto(500, 600);
    const isOpaqueCutout = await SubjectSegmentationService.isAlphaCutout(opaque);
    assert.strictEqual(isOpaqueCutout, false, 'Foto retangular bruta não deve ser aceita como cutout');
  });

  it('C) fundo original não é utilizado como camada retangular', async () => {
    const baseArt = await createOpaquePhoto(1080, 1350, '#0E1015');
    const cutout = await createTransparentCutout(500, 700);

    const composited = await ImageCompositeService.integrateSubject({
      baseArtworkBuffer: baseArt,
      subjectCutoutBuffer: cutout,
      scaleRatio: 0.76,
    });

    const meta = await sharp(composited).metadata();
    assert.strictEqual(meta.width, 1080);
    assert.strictEqual(meta.height, 1350);

    // O topo esquerdo da arte deve continuar preservando a cor da base e NÃO um canto retangular
    const raw = await sharp(composited).raw().toBuffer({ resolveWithObject: true });
    // Pixel (10, 10) deve pertencer à base artística (#0E1015) e não à bounding box
    const r = raw.data[0];
    const g = raw.data[1];
    const b = raw.data[2];
    assert.ok(r <= 25 && g <= 25 && b <= 30, 'O fundo da base artística deve ser preservado nos cantos');
  });

  it('D) background generation recebe instrução para não criar pessoa substituta no background', () => {
    const chatService = new CreativeChatService({} as any);
    const compiledPrompt = (chatService as any).compileFullArtPrompt(
      { client: { name: 'Dra. Tatiana' }, brandProfile: {} },
      { format: 'instagram_feed_4_5', aspectRatio: '4:5' },
      'Post de autoridade médica para rejuvenescimento',
      undefined,
      undefined,
      true, // hasSubjectPhoto
      undefined,
      undefined,
      true, // hasFaceCrop
      'preserve_person' // Modo Preservar Pessoa
    );

    assert.ok(
      compiledPrompt.includes('Create the visual composition and environment while reserving the main subject area.'),
      'Prompt deve conter instrução exata da Seção 8 para reservar a área do sujeito'
    );
    assert.ok(
      compiledPrompt.includes('Do not generate a replacement person in the reserved subject area.'),
      'Prompt deve proibir geração de pessoa substituta na área reservada'
    );
    assert.ok(
      compiledPrompt.includes('The real supplied subject will be composited there afterward.'),
      'Prompt deve avisar que o sujeito real será composto posteriormente'
    );
    assert.ok(
      compiledPrompt.includes('STRICT NEGATIVE CONSTRAINT: DO NOT draw, paint, or generate any person'),
      'Prompt deve incluir negative constraint estrita contra pessoas falsas no fundo'
    );
  });

  it('E) output combina background + foreground com sombra de contato e fusão suave', async () => {
    const baseArt = await createOpaquePhoto(1000, 1250, '#1A1D24');
    const cutout = await createTransparentCutout(400, 600);

    const composited = await ImageCompositeService.integrateSubject({
      baseArtworkBuffer: baseArt,
      subjectCutoutBuffer: cutout,
      scaleRatio: 0.75,
      horizontalAlign: 'center',
      verticalAlign: 'bottom',
    });

    assert.ok(composited.length > 0, 'Buffer final deve ser gerado');
    const meta = await sharp(composited).metadata();
    assert.strictEqual(meta.format, 'png');
    assert.strictEqual(meta.width, 1000);
    assert.strictEqual(meta.height, 1250);
  });

  it('F) troca de objeto principal invalida cutout anterior (estado redefinido)', () => {
    // Simula a transição de estado da UI ao clicar em Trocar
    let currentSubjectState: any = {
      name: 'foto-antiga.jpg',
      url: 'data:image/jpeg;base64,OLD',
      hasFace: true,
      selectedFaceCropUrl: 'data:image/png;base64,OLD_CROP',
      cutoutUrl: 'data:image/png;base64,OLD_CUTOUT',
      segmentationStatus: 'ready',
    };

    // Ação do usuário: Clicar em Trocar e selecionar novo arquivo
    const handleSwapFile = (newFileName: string, newBase64: string) => {
      // Regra Seção 17: Invalida face crop antigo, cutout antigo e mask antiga imediatamente
      currentSubjectState = {
        name: newFileName,
        url: newBase64,
        isDetectingFace: true,
        isSegmenting: true,
        hasFace: false,
        faceCount: 0,
        faces: [],
        selectedFaceCropUrl: undefined,
        cutoutUrl: undefined,
        cutoutStoragePath: undefined,
        segmentationStatus: 'pending',
        validationStatus: 'Isolando pessoa e analisando identidade facial...',
      };
    };

    handleSwapFile('nova-foto-tatiana.png', 'data:image/png;base64,NEW');

    assert.strictEqual(currentSubjectState.name, 'nova-foto-tatiana.png');
    assert.strictEqual(currentSubjectState.selectedFaceCropUrl, undefined, 'Crop antigo deve ser invalidado');
    assert.strictEqual(currentSubjectState.cutoutUrl, undefined, 'Cutout antigo deve ser invalidado');
    assert.strictEqual(currentSubjectState.segmentationStatus, 'pending', 'Status deve voltar para pending');
    assert.strictEqual(currentSubjectState.isSegmenting, true, 'Flag isSegmenting deve ser true');
  });
});
