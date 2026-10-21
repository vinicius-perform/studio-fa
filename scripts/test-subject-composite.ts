// scripts/test-subject-composite.ts
import fs from 'node:fs';
import sharp from 'sharp';

async function testComposite() {
  const subjectPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/.user_uploaded/media_1792525732743_c86dda60.png';
  const artworkPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-real-facial-preservation-art.png';

  const subjectBuf = fs.readFileSync(subjectPath);
  const artworkBuf = fs.readFileSync(artworkPath);

  const artMeta = await sharp(artworkBuf).metadata();
  const artW = artMeta.width || 1080;
  const artH = artMeta.height || 1350;

  console.log('Artwork dimensions:', artW, 'x', artH);

  // Redimensiona a pessoa para ~72% da altura da arte
  const targetH = Math.round(artH * 0.72);
  const resizedSubject = await sharp(subjectBuf)
    .resize({ height: targetH, fit: 'inside' })
    .png()
    .toBuffer();

  const subMeta = await sharp(resizedSubject).metadata();
  const subW = subMeta.width || 600;
  const subH = subMeta.height || targetH;

  console.log('Resized subject dimensions:', subW, 'x', subH);

  // Cria máscara de fade gradiente suave na base para fusão fotográfica profissional
  const maskSvg = Buffer.from(`
    <svg width="${subW}" height="${subH}">
      <defs>
        <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity="1" />
          <stop offset="75%" stop-color="#fff" stop-opacity="1" />
          <stop offset="92%" stop-color="#fff" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="${subW}" height="${subH}" fill="url(#bottomFade)" />
    </svg>
  `);

  const maskPng = await sharp(maskSvg).png().toBuffer();

  // Aplica a máscara no sujeito
  const fadedSubject = await sharp(resizedSubject)
    .ensureAlpha()
    .composite([
      {
        input: maskPng,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  // Posiciona a pessoa no centro horizontal e na base inferior da arte
  const posX = Math.max(0, Math.round((artW - subW) / 2));
  const posY = Math.max(0, artH - subH);

  console.log(`Composite coordinates: left=${posX}, top=${posY}`);

  const finalComposite = await sharp(artworkBuf)
    .composite([
      {
        input: fadedSubject,
        left: posX,
        top: posY,
      },
    ])
    .png()
    .toBuffer();

  const outPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-preserved-subject-composite.png';
  fs.writeFileSync(outPath, finalComposite);
  console.log('Saved integrated preserved image to:', outPath);
}

testComposite().catch(console.error);
