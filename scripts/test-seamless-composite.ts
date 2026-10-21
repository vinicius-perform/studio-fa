// scripts/test-seamless-composite.ts
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function main() {
  const artPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-real-person-preserved-final.png';
  const cutoutPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-subject-cutout.png';

  const baseArt = fs.readFileSync(artPath);
  const cutout = fs.readFileSync(cutoutPath);

  const artMeta = await sharp(baseArt).metadata();
  const artW = artMeta.width || 1024;
  const artH = artMeta.height || 1280;

  // Scale subject to ~76% of artwork height
  const targetH = Math.round(artH * 0.76);
  const resizedCutout = await sharp(cutout)
    .resize({ height: targetH, fit: 'inside' })
    .png()
    .toBuffer();

  const subMeta = await sharp(resizedCutout).metadata();
  const subW = subMeta.width || 500;
  const subH = subMeta.height || targetH;

  // Bottom fade gradient on cutout
  const maskSvg = Buffer.from(`
    <svg width="${subW}" height="${subH}">
      <defs>
        <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity="1" />
          <stop offset="85%" stop-color="#fff" stop-opacity="1" />
          <stop offset="96%" stop-color="#fff" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="${subW}" height="${subH}" fill="url(#bottomFade)" />
    </svg>
  `);
  const maskPng = await sharp(maskSvg).png().toBuffer();

  const fadedSubject = await sharp(resizedCutout)
    .composite([{ input: maskPng, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Create soft drop shadow from subject silhouette
  const alphaMask = await sharp(resizedCutout).extractChannel(3).toBuffer();
  const blurredShadow = await sharp(alphaMask)
    .blur(14)
    .toBuffer();

  const shadowLayer = await sharp({
    create: {
      width: subW,
      height: subH,
      channels: 4,
      background: { r: 15, g: 15, b: 20, alpha: 0.35 },
    },
  })
    .composite([{ input: blurredShadow, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const posX = Math.round((artW - subW) / 2);
  const posY = artH - subH;

  const finalComposite = await sharp(baseArt)
    .composite([
      { input: shadowLayer, left: posX + 4, top: posY + 8 },
      { input: fadedSubject, left: posX, top: posY },
    ])
    .png()
    .toBuffer();

  const outPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-seamless-cutout-composite.png';
  fs.writeFileSync(outPath, finalComposite);
  console.log('Saved seamless cutout composite to:', outPath);
}

main().catch(console.error);
